import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { CrawlController } from './crawl.controller';
import { QnaController } from './qna.controller';
import { TextTrainingController } from './text-training.controller';
import { CrawlService } from './crawl.service';
import { QnaService } from './qna.service';
import { TextTrainingService } from './text-training.service';
import { EmbeddingService } from './embedding.service';
import { RagService } from './rag.service';
import { CrawlWorker } from './crawl.worker';
import { TrainingWorker } from './training.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'crawl-queue' }),
    BullModule.registerQueue({ name: 'training-queue' }),
    ChatbotModule,
  ],
  controllers: [CrawlController, QnaController, TextTrainingController],
  providers: [
    CrawlService,
    QnaService,
    TextTrainingService,
    EmbeddingService,
    RagService,
    CrawlWorker,
    TrainingWorker,
  ],
  exports: [RagService, EmbeddingService],
})
export class KnowledgeModule {}
