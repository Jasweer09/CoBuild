import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateConversationDto, UpdateConversationDto } from './dto';
import { MessageRole } from '../../generated/prisma';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, orgId: string, dto: CreateConversationDto) {
    // Verify chatbot belongs to org
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: dto.chatbotId, orgId },
    });

    if (!chatbot) {
      throw new ForbiddenException('Chatbot not found or access denied');
    }

    return this.prisma.conversation.create({
      data: {
        chatbotId: dto.chatbotId,
        userId,
        title: dto.title || 'New Conversation',
      },
    });
  }

  async findAllByBot(
    chatbotId: string,
    orgId: string,
    userId: string,
    page = 1,
    limit = 20,
  ) {
    // Verify chatbot belongs to org
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: chatbotId, orgId },
    });

    if (!chatbot) {
      throw new ForbiddenException('Chatbot not found or access denied');
    }

    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { chatbotId, userId },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { content: true, role: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where: { chatbotId, userId } }),
    ]);

    return {
      conversations,
      totalDocs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  async findById(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        chatbot: {
          select: {
            id: true,
            name: true,
            aiModel: true,
            systemPrompt: true,
            initialMessage: true,
            suggestedMessages: true,
            appearance: true,
            showCitations: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async update(id: string, userId: string, dto: UpdateConversationDto) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversation.delete({ where: { id } });
    return { deleted: true };
  }

  async addMessage(
    conversationId: string,
    content: string,
    role: MessageRole,
    senderId?: string,
    citations?: unknown,
    tokenCount?: number,
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        content,
        role,
        senderId,
        citations: citations ? JSON.parse(JSON.stringify(citations)) : undefined,
        tokenCount,
      },
    });

    // Update conversation updatedAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Auto-generate title from first user message
  async autoTitle(conversationId: string, firstMessage: string) {
    const title =
      firstMessage.length > 60
        ? firstMessage.substring(0, 57) + '...'
        : firstMessage;

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}
