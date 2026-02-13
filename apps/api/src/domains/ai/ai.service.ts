import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, generateText, CoreMessage } from 'ai';

export type AiProvider = 'gemini' | 'anthropic';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  private getModel(modelName: string) {
    if (modelName.startsWith('gemini')) {
      const google = createGoogleGenerativeAI({
        apiKey: this.configService.get<string>('GEMINI_API_KEY'),
      });
      return google(modelName);
    }

    if (
      modelName.startsWith('claude') ||
      modelName.startsWith('anthropic')
    ) {
      const anthropic = createAnthropic({
        apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
      });
      return anthropic(modelName);
    }

    // Default to Gemini Flash
    const google = createGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
    return google('gemini-2.5-flash');
  }

  async streamChat(params: {
    modelName: string;
    systemPrompt?: string;
    messages: CoreMessage[];
    temperature?: number;
    onChunk?: (chunk: string) => void;
  }) {
    const model = this.getModel(params.modelName);

    const result = streamText({
      model,
      system: params.systemPrompt || undefined,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      maxTokens: 4096,
    });

    return result;
  }

  async generateResponse(params: {
    modelName: string;
    systemPrompt?: string;
    messages: CoreMessage[];
    temperature?: number;
  }) {
    const model = this.getModel(params.modelName);

    const result = await generateText({
      model,
      system: params.systemPrompt || undefined,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      maxTokens: 4096,
    });

    return {
      content: result.text,
      usage: result.usage,
    };
  }
}
