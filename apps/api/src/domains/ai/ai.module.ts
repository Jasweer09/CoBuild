import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ConversationModule } from '../conversation/conversation.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [ConversationModule, ChatbotModule, KnowledgeModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
