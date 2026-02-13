import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

export interface RetrievedContext {
  content: string;
  score: number;
  metadata: any;
}

export interface RagResult {
  augmentedPrompt: string;
  contexts: RetrievedContext[];
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(private readonly embeddingService: EmbeddingService) {}

  /**
   * Retrieve the top-K most relevant knowledge chunks for a user query.
   */
  async retrieveContext(
    chatbotId: string,
    query: string,
    topK = 5,
  ): Promise<RetrievedContext[]> {
    const results = await this.embeddingService.search(
      chatbotId,
      query,
      topK,
    );

    // Filter out low-confidence results (below 0.3 cosine similarity)
    const filtered = results.filter((r) => r.score > 0.3);

    this.logger.debug(
      `RAG: retrieved ${filtered.length}/${results.length} relevant chunks for chatbot ${chatbotId}`,
    );

    return filtered;
  }

  /**
   * Build an augmented system prompt by prepending retrieved knowledge
   * context to the original system prompt.
   */
  buildAugmentedPrompt(
    systemPrompt: string | null | undefined,
    contexts: RetrievedContext[],
  ): RagResult {
    if (contexts.length === 0) {
      return {
        augmentedPrompt: systemPrompt || '',
        contexts: [],
      };
    }

    const contextBlock = contexts
      .map((ctx, i) => `[Source ${i + 1}] ${ctx.content}`)
      .join('\n\n');

    const ragPrefix = [
      'Use the following knowledge base context to answer the user\'s question.',
      'If the context is relevant, incorporate it into your response.',
      'If the context is not relevant to the question, rely on your general knowledge.',
      'When using information from the context, be accurate and helpful.',
      '',
      '--- Knowledge Base Context ---',
      contextBlock,
      '--- End Context ---',
      '',
    ].join('\n');

    const base = systemPrompt || '';
    const augmentedPrompt = base
      ? `${ragPrefix}\n${base}`
      : ragPrefix;

    return { augmentedPrompt, contexts };
  }

  /**
   * Convenience method: retrieve context and build an augmented prompt
   * in a single call.
   */
  async augment(
    chatbotId: string,
    query: string,
    systemPrompt?: string | null,
    topK = 5,
  ): Promise<RagResult> {
    const contexts = await this.retrieveContext(chatbotId, query, topK);
    return this.buildAugmentedPrompt(systemPrompt, contexts);
  }
}
