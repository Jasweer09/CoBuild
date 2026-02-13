import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { CacheModule } from './core/cache/cache.module';
import { QueueModule } from './core/queue/queue.module';
import { configValidation } from './core/config/config.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: configValidation,
    }),
    DatabaseModule,
    CacheModule,
    QueueModule,
    // Domain modules (uncomment as built)
    // TenantModule,
    // UserModule,
    // ChatbotModule,
    // AiModule,
    // KnowledgeModule,
    // ConversationModule,
    // BillingModule,
    // AnalyticsModule,
    // NotificationModule,
    // IntegrationModule,
    // DeploymentModule,
    // CollaborationModule,
    // AdminModule,
    // CmsModule,
  ],
})
export class AppModule {}
