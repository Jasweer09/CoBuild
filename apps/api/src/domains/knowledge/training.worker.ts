import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../core/database/prisma.service';
import { TrainingStatus, SourceType } from '../../generated/prisma';
import { EmbeddingService } from './embedding.service';

interface TrainingJobData {
  type: 'qna' | 'text' | 'crawl-page';
  chatbotId: string;
  sourceId: string;
}

@Processor('training-queue')
export class TrainingWorker extends WorkerHost {
  private readonly logger = new Logger(TrainingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {
    super();
  }

  async process(job: Job<TrainingJobData>): Promise<void> {
    const { type, chatbotId, sourceId } = job.data;
    this.logger.log(
      `Processing training job: type=${type}, chatbotId=${chatbotId}, sourceId=${sourceId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      switch (type) {
        case 'qna':
          await this.processQna(chatbotId, sourceId);
          break;
        case 'text':
          await this.processText(chatbotId, sourceId);
          break;
        case 'crawl-page':
          await this.processCrawlPage(chatbotId, sourceId);
          break;
        default:
          this.logger.warn(`Unknown training job type: ${type}`);
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Training job failed (${type}/${sourceId}): ${message}`,
      );
      await this.markFailed(type, sourceId);
      throw err; // Re-throw so BullMQ can retry
    }
  }

  /**
   * Process a QnA pair: combine question + answer into a single text,
   * generate embeddings, and store them.
   */
  private async processQna(chatbotId: string, qnaId: string): Promise<void> {
    const qna = await this.prisma.qnaPair.findUnique({
      where: { id: qnaId },
    });

    if (!qna) {
      this.logger.warn(`QnA pair ${qnaId} not found, skipping`);
      return;
    }

    // Update status to PROCESSING
    await this.prisma.qnaPair.update({
      where: { id: qnaId },
      data: { trainingStatus: TrainingStatus.PROCESSING },
    });

    const combinedText = `Question: ${qna.question}\nAnswer: ${qna.answer}`;

    await this.embeddingService.storeEmbeddings(
      chatbotId,
      SourceType.QNA,
      qnaId,
      [combinedText],
    );

    await this.prisma.qnaPair.update({
      where: { id: qnaId },
      data: { trainingStatus: TrainingStatus.TRAINED },
    });

    this.logger.log(`QnA pair ${qnaId} trained successfully`);
  }

  /**
   * Process text training content: chunk the full text, generate
   * embeddings for each chunk, and store them.
   */
  private async processText(
    chatbotId: string,
    textTrainingId: string,
  ): Promise<void> {
    const textTraining = await this.prisma.textTraining.findUnique({
      where: { id: textTrainingId },
    });

    if (!textTraining) {
      this.logger.warn(
        `Text training ${textTrainingId} not found, skipping`,
      );
      return;
    }

    await this.prisma.textTraining.update({
      where: { id: textTrainingId },
      data: { trainingStatus: TrainingStatus.PROCESSING },
    });

    await this.embeddingService.storeEmbeddings(
      chatbotId,
      SourceType.TEXT,
      textTrainingId,
      [textTraining.content],
    );

    await this.prisma.textTraining.update({
      where: { id: textTrainingId },
      data: { trainingStatus: TrainingStatus.TRAINED },
    });

    this.logger.log(
      `Text training ${textTrainingId} trained successfully`,
    );
  }

  /**
   * Process a crawled page: read the stored content, chunk it,
   * generate embeddings, and store them.
   */
  private async processCrawlPage(
    chatbotId: string,
    pageId: string,
  ): Promise<void> {
    const page = await this.prisma.crawledPage.findUnique({
      where: { id: pageId },
    });

    if (!page) {
      this.logger.warn(`Crawled page ${pageId} not found, skipping`);
      return;
    }

    // storagePath contains the extracted text content
    const content = page.storagePath;
    if (!content) {
      this.logger.warn(`Crawled page ${pageId} has no content, skipping`);
      return;
    }

    await this.embeddingService.storeEmbeddings(
      chatbotId,
      SourceType.CRAWL,
      pageId,
      [content],
    );

    this.logger.log(`Crawled page ${pageId} trained successfully`);
  }

  /**
   * Mark a training source as FAILED based on its type.
   */
  private async markFailed(
    type: string,
    sourceId: string,
  ): Promise<void> {
    try {
      switch (type) {
        case 'qna':
          await this.prisma.qnaPair.update({
            where: { id: sourceId },
            data: { trainingStatus: TrainingStatus.FAILED },
          });
          break;
        case 'text':
          await this.prisma.textTraining.update({
            where: { id: sourceId },
            data: { trainingStatus: TrainingStatus.FAILED },
          });
          break;
        // crawl-page doesn't have a trainingStatus field
      }
    } catch (err) {
      this.logger.warn(
        `Failed to mark ${type}/${sourceId} as FAILED: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
