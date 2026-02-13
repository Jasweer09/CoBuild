import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma, SourceType } from '../../generated/prisma';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;
  private readonly model = 'text-embedding-3-small';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Generate an embedding vector for the given text using OpenAI's
   * text-embedding-3-small model (1536 dimensions).
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const cleaned = text.replace(/\n+/g, ' ').trim();
    if (!cleaned) {
      throw new Error('Cannot generate embedding for empty text');
    }

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: cleaned,
    });

    return response.data[0].embedding;
  }

  /**
   * Split text into overlapping chunks for embedding.
   * Uses word boundaries so we never break mid-word.
   */
  chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      const chunk = words.slice(start, end).join(' ');
      chunks.push(chunk);

      if (end >= words.length) break;
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Chunk the provided texts, embed each chunk, and store them all in
   * the embeddings table using raw SQL for pgvector compatibility.
   */
  async storeEmbeddings(
    chatbotId: string,
    sourceType: SourceType,
    sourceId: string,
    texts: string[],
  ): Promise<number> {
    const allChunks: string[] = [];
    for (const text of texts) {
      const chunks = this.chunkText(text);
      allChunks.push(...chunks);
    }

    if (allChunks.length === 0) {
      this.logger.warn(`No chunks generated for source ${sourceId}`);
      return 0;
    }

    this.logger.log(
      `Generating embeddings for ${allChunks.length} chunks (source: ${sourceType}/${sourceId})`,
    );

    let stored = 0;

    // Process in batches of 20 to stay within OpenAI's rate limits
    const batchSize = 20;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: batch,
      });

      for (let j = 0; j < batch.length; j++) {
        const id = randomUUID();
        const vector = response.data[j].embedding;
        const vectorStr = `[${vector.join(',')}]`;
        const metadata = JSON.stringify({
          chunkIndex: i + j,
          totalChunks: allChunks.length,
        });

        await this.prisma.$executeRaw`
          INSERT INTO embeddings (id, chatbot_id, source_type, source_id, content, embedding, metadata, created_at)
          VALUES (
            ${id},
            ${chatbotId},
            ${sourceType}::"SourceType",
            ${sourceId},
            ${batch[j]},
            ${vectorStr}::vector,
            ${metadata}::jsonb,
            NOW()
          )
        `;
        stored++;
      }
    }

    this.logger.log(
      `Stored ${stored} embeddings for source ${sourceType}/${sourceId}`,
    );
    return stored;
  }

  /**
   * Delete all embeddings associated with a specific source.
   */
  async deleteBySource(
    chatbotId: string,
    sourceType: SourceType,
    sourceId: string,
  ): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM embeddings
      WHERE chatbot_id = ${chatbotId}
        AND source_type = ${sourceType}::"SourceType"
        AND source_id = ${sourceId}
    `;
    return result;
  }

  /**
   * Semantic search across stored embeddings using cosine similarity.
   * Returns the top-K most relevant chunks with their scores.
   */
  async search(
    chatbotId: string,
    query: string,
    topK = 5,
  ): Promise<{ content: string; score: number; metadata: any }[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const vectorStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<
      { id: string; content: string; metadata: any; score: number }[]
    >`
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> ${vectorStr}::vector) AS score
      FROM embeddings
      WHERE chatbot_id = ${chatbotId}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;

    return results.map((r) => ({
      content: r.content,
      score: Number(r.score),
      metadata: r.metadata,
    }));
  }
}
