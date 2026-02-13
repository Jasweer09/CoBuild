import {
  Controller,
  Post,
  Body,
  Param,
  Res,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { ConversationService } from '../conversation/conversation.service';
import { ChatbotService } from '../chatbot/chatbot.service';
import { CacheService } from '../../core/cache/cache.service';
import { CurrentUser } from '../../core/common/decorators';
import { MessageRole } from '../../generated/prisma';
import { CoreMessage } from 'ai';

class ChatDto {
  content: string;
  conversationId?: string;
  chatbotId: string;
}

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly conversationService: ConversationService,
    private readonly chatbotService: ChatbotService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(
    @CurrentUser('id') userId: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    // Validate chatbot ownership
    const chatbot = await this.chatbotService.validateOwnership(
      dto.chatbotId,
      orgId,
    );

    // Check rate limiting
    if (chatbot.rateLimitEnabled) {
      await this.checkRateLimit(chatbot.id, userId, chatbot);
    }

    // Get or create conversation
    let conversationId = dto.conversationId;
    let isNewConversation = false;

    if (!conversationId) {
      const conversation = await this.conversationService.create(userId, orgId, {
        chatbotId: dto.chatbotId,
      });
      conversationId = conversation.id;
      isNewConversation = true;
    }

    // Save user message
    await this.conversationService.addMessage(
      conversationId,
      dto.content,
      MessageRole.USER,
      userId,
    );

    // Auto-title on first message
    if (isNewConversation) {
      await this.conversationService.autoTitle(conversationId, dto.content);
    }

    // Get conversation history
    const messages = await this.conversationService.getMessages(
      conversationId,
      userId,
    );

    // Convert to AI SDK format
    const aiMessages: CoreMessage[] = messages.map((m) => ({
      role: m.role === MessageRole.USER ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Conversation-Id', conversationId);
    res.flushHeaders();

    try {
      // Stream AI response
      const result = await this.aiService.streamChat({
        modelName: chatbot.aiModel,
        systemPrompt: chatbot.systemPrompt ?? undefined,
        messages: aiMessages,
        temperature: chatbot.temperature,
      });

      let fullContent = '';

      for await (const chunk of result.textStream) {
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Save assistant response
      const usage = await result.usage;
      await this.conversationService.addMessage(
        conversationId,
        fullContent,
        MessageRole.ASSISTANT,
        undefined,
        undefined,
        usage?.totalTokens,
      );

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          isComplete: true,
          conversationId,
          usage,
        })}\n\n`,
      );

      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          error: 'Failed to generate response',
          isComplete: true,
        })}\n\n`,
      );
      res.end();
    }
  }

  private async checkRateLimit(
    chatbotId: string,
    identifier: string,
    chatbot: {
      rateLimitMessages?: number | null;
      rateLimitWindowMinutes?: number | null;
      rateLimitErrorMessage?: string | null;
    },
  ) {
    const maxMessages = chatbot.rateLimitMessages ?? 20;
    const windowMinutes = chatbot.rateLimitWindowMinutes ?? 60;
    const key = `ratelimit:${chatbotId}:${identifier}`;

    const count = await this.cacheService.incr(key);

    if (count === 1) {
      await this.cacheService.expire(key, windowMinutes * 60);
    }

    if (count > maxMessages) {
      throw new ForbiddenException(
        chatbot.rateLimitErrorMessage ||
          `Rate limit exceeded. Please try again later.`,
      );
    }
  }
}
