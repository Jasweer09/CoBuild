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
import { CreateQnaDto, BulkCreateQnaDto, UpdateQnaDto } from './dto';

@Injectable()
export class QnaService {
  private readonly logger = new Logger(QnaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbotService: ChatbotService,
    private readonly embeddingService: EmbeddingService,
    @InjectQueue('training-queue') private readonly trainingQueue: Queue,
  ) {}

  /**
   * Create a single Q&A pair and enqueue it for embedding generation.
   */
  async create(orgId: string, dto: CreateQnaDto) {
    await this.chatbotService.validateOwnership(dto.chatbotId, orgId);

    const qna = await this.prisma.qnaPair.create({
      data: {
        chatbotId: dto.chatbotId,
        question: dto.question,
        answer: dto.answer,
        trainingStatus: TrainingStatus.PENDING,
      },
    });

    await this.trainingQueue.add(
      'train',
      {
        type: 'qna',
        chatbotId: dto.chatbotId,
        sourceId: qna.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(`QnA pair ${qna.id} created for chatbot ${dto.chatbotId}`);
    return qna;
  }

  /**
   * Bulk-create Q&A pairs and enqueue them all for training.
   */
  async bulkCreate(orgId: string, dto: BulkCreateQnaDto) {
    await this.chatbotService.validateOwnership(dto.chatbotId, orgId);

    const created = await this.prisma.$transaction(
      dto.pairs.map((pair) =>
        this.prisma.qnaPair.create({
          data: {
            chatbotId: dto.chatbotId,
            question: pair.question,
            answer: pair.answer,
            trainingStatus: TrainingStatus.PENDING,
          },
        }),
      ),
    );

    // Enqueue each QnA pair for training
    for (const qna of created) {
      await this.trainingQueue.add(
        'train',
        {
          type: 'qna',
          chatbotId: dto.chatbotId,
          sourceId: qna.id,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    this.logger.log(
      `Bulk created ${created.length} QnA pairs for chatbot ${dto.chatbotId}`,
    );

    return { created: created.length, qnaPairs: created };
  }

  /**
   * Paginated list of Q&A pairs for a chatbot with optional search and
   * status filter.
   */
  async findAllByBot(
    chatbotId: string,
    page = 1,
    limit = 20,
    search?: string,
    status?: TrainingStatus,
  ) {
    const skip = (page - 1) * limit;

    const where: any = { chatbotId };
    if (status) {
      where.trainingStatus = status;
    }
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [qnaPairs, total] = await Promise.all([
      this.prisma.qnaPair.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.qnaPair.count({ where }),
    ]);

    return {
      qnaPairs,
      totalDocs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  /**
   * Get a single Q&A pair by ID.
   */
  async findById(qnaId: string) {
    const qna = await this.prisma.qnaPair.findUnique({
      where: { id: qnaId },
    });

    if (!qna) {
      throw new NotFoundException('QnA pair not found');
    }

    return qna;
  }

  /**
   * Update a Q&A pair. If the question or answer changed, delete old
   * embeddings and re-enqueue for training.
   */
  async update(qnaId: string, orgId: string, dto: UpdateQnaDto) {
    const qna = await this.prisma.qnaPair.findUnique({
      where: { id: qnaId },
      include: { chatbot: { select: { orgId: true } } },
    });

    if (!qna) {
      throw new NotFoundException('QnA pair not found');
    }

    if (qna.chatbot.orgId !== orgId) {
      throw new ForbiddenException('Access denied');
    }

    const contentChanged =
      (dto.question !== undefined && dto.question !== qna.question) ||
      (dto.answer !== undefined && dto.answer !== qna.answer);

    const updateData: any = {};
    if (dto.question !== undefined) updateData.question = dto.question;
    if (dto.answer !== undefined) updateData.answer = dto.answer;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (contentChanged) {
      updateData.trainingStatus = TrainingStatus.PENDING;
    }

    const updated = await this.prisma.qnaPair.update({
      where: { id: qnaId },
      data: updateData,
    });

    if (contentChanged) {
      // Delete old embeddings and re-train
      await this.embeddingService.deleteBySource(
        qna.chatbotId,
        SourceType.QNA,
        qnaId,
      );

      await this.trainingQueue.add(
        'train',
        {
          type: 'qna',
          chatbotId: qna.chatbotId,
          sourceId: qnaId,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    return updated;
  }

  /**
   * Delete a Q&A pair and its associated embeddings.
   */
  async delete(qnaId: string, orgId: string) {
    const qna = await this.prisma.qnaPair.findUnique({
      where: { id: qnaId },
      include: { chatbot: { select: { orgId: true } } },
    });

    if (!qna) {
      throw new NotFoundException('QnA pair not found');
    }

    if (qna.chatbot.orgId !== orgId) {
      throw new ForbiddenException('Access denied');
    }

    // Delete embeddings first, then the QnA pair
    await this.embeddingService.deleteBySource(
      qna.chatbotId,
      SourceType.QNA,
      qnaId,
    );

    await this.prisma.qnaPair.delete({ where: { id: qnaId } });

    this.logger.log(`QnA pair ${qnaId} deleted`);
    return { deleted: true };
  }
}
