import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../core/database/prisma.service';
import { TrainingStatus, SourceType } from '../../generated/prisma';
import { ChatbotService } from '../chatbot/chatbot.service';
import { EmbeddingService } from './embedding.service';
import { UpsertTextTrainingDto } from './dto';

@Injectable()
export class TextTrainingService {
  private readonly logger = new Logger(TextTrainingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbotService: ChatbotService,
    private readonly embeddingService: EmbeddingService,
    @InjectQueue('training-queue') private readonly trainingQueue: Queue,
  ) {}

  /**
   * Create or replace the text training content for a chatbot.
   * Each chatbot has at most one TextTraining record (unique on chatbotId).
   * When content is updated, old embeddings are deleted and re-generated.
   */
  async upsert(orgId: string, dto: UpsertTextTrainingDto) {
    await this.chatbotService.validateOwnership(dto.chatbotId, orgId);

    // Check for existing text training
    const existing = await this.prisma.textTraining.findUnique({
      where: { chatbotId: dto.chatbotId },
    });

    let textTraining;

    if (existing) {
      // Delete old embeddings before overwriting content
      await this.embeddingService.deleteBySource(
        dto.chatbotId,
        SourceType.TEXT,
        existing.id,
      );

      textTraining = await this.prisma.textTraining.update({
        where: { chatbotId: dto.chatbotId },
        data: {
          content: dto.content,
          trainingStatus: TrainingStatus.PENDING,
        },
      });
    } else {
      textTraining = await this.prisma.textTraining.create({
        data: {
          chatbotId: dto.chatbotId,
          content: dto.content,
          trainingStatus: TrainingStatus.PENDING,
        },
      });
    }

    // Enqueue for embedding generation
    await this.trainingQueue.add(
      'train',
      {
        type: 'text',
        chatbotId: dto.chatbotId,
        sourceId: textTraining.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `Text training ${existing ? 'updated' : 'created'} for chatbot ${dto.chatbotId}`,
    );

    return textTraining;
  }

  /**
   * Retrieve the text training record for a chatbot.
   */
  async findByBot(chatbotId: string) {
    const textTraining = await this.prisma.textTraining.findUnique({
      where: { chatbotId },
    });

    if (!textTraining) {
      throw new NotFoundException('No text training found for this chatbot');
    }

    return textTraining;
  }

  /**
   * Delete the text training content and all associated embeddings.
   */
  async delete(chatbotId: string, orgId: string) {
    await this.chatbotService.validateOwnership(chatbotId, orgId);

    const textTraining = await this.prisma.textTraining.findUnique({
      where: { chatbotId },
    });

    if (!textTraining) {
      throw new NotFoundException('No text training found for this chatbot');
    }

    // Delete embeddings first
    await this.embeddingService.deleteBySource(
      chatbotId,
      SourceType.TEXT,
      textTraining.id,
    );

    await this.prisma.textTraining.delete({ where: { chatbotId } });

    this.logger.log(`Text training deleted for chatbot ${chatbotId}`);
    return { deleted: true };
  }
}
