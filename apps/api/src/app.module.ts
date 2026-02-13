import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './core/database/database.module';
import { CacheModule } from './core/cache/cache.module';
import { QueueModule } from './core/queue/queue.module';
import { configValidation } from './core/config/config.validation';
import { JwtAuthGuard } from './core/common/guards/jwt-auth.guard';
import { RolesGuard } from './core/common/guards/roles.guard';
import { AuthModule } from './domains/auth/auth.module';
import { UserModule } from './domains/user/user.module';
import { TenantModule } from './domains/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: configValidation,
    }),
    DatabaseModule,
    CacheModule,
    QueueModule,
    // Phase 1: Auth & Multi-tenancy
    AuthModule,
    UserModule,
    TenantModule,
    // Domain modules (uncomment as built)
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
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
