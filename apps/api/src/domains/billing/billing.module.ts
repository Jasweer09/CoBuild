import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { WebhookController } from './webhook.controller';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { WebhookService } from './webhook.service';
import { CreditService } from './credit.service';
import { UsageService } from './usage.service';

@Module({
  controllers: [BillingController, WebhookController],
  providers: [
    PlanService,
    SubscriptionService,
    StripeService,
    WebhookService,
    CreditService,
    UsageService,
  ],
  exports: [CreditService, UsageService],
})
export class BillingModule {}
