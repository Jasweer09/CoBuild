import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { SubscriptionService } from './subscription.service';
import { CreditService } from './credit.service';
import { UsageService } from './usage.service';
import {
  SubscriptionStatus,
  BillingPeriod,
  PlanType,
  CreditTransactionType,
} from '../../generated/prisma';
import Stripe from 'stripe';

/**
 * Shape of the `features` JSON field stored on the Plan model.
 */
interface PlanFeatures {
  chatbots?: number;
  messagesPerMonth?: number;
  crawlPages?: number;
  fileUploads?: number;
  qnaPairs?: number;
  [key: string]: number | undefined;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly creditService: CreditService,
    private readonly usageService: UsageService,
  ) {}

  async handleWebhook(event: Stripe.Event) {
    // Idempotency check — skip already-processed events
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existing?.processed) {
      this.logger.log(`Event ${event.id} already processed, skipping`);
      return { received: true, skipped: true };
    }

    // Record the event (or upsert if it exists but was not processed)
    await this.prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        type: event.type,
        processed: false,
      },
      update: {},
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      // Mark as processed
      await this.prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processed: true },
      });

      return { received: true };
    } catch (error) {
      this.logger.error(
        `Error processing webhook ${event.type}: ${error.message}`,
        error.stack,
      );

      // Record the error but do not mark as processed so it can be retried
      await this.prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: { error: error.message },
      });

      throw error;
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode !== 'subscription') return;

    const orgId = session.metadata?.orgId;
    const planId = session.metadata?.planId;
    const billingPeriod =
      (session.metadata?.billingPeriod as BillingPeriod) || BillingPeriod.MONTHLY;

    if (!orgId || !planId) {
      this.logger.warn(
        'checkout.session.completed missing orgId or planId in metadata',
      );
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription)?.id;

    if (!stripeSubscriptionId) {
      this.logger.warn('checkout.session.completed has no subscription ID');
      return;
    }

    // Deactivate any existing subscription for this org
    await this.prisma.subscription.updateMany({
      where: {
        orgId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
      },
      data: { status: SubscriptionStatus.CANCELED },
    });

    // Create the new subscription record
    const subscription = await this.prisma.subscription.create({
      data: {
        orgId,
        planId,
        stripeSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        billingPeriod,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });

    // Initialize feature usage from plan features
    const features = subscription.plan.features as PlanFeatures | null;
    if (features) {
      await this.usageService.initializeUsage(orgId, features);
    }

    this.logger.log(
      `Subscription created for org ${orgId}, plan ${subscription.plan.name}`,
    );
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      trialing: SubscriptionStatus.TRIALING,
      paused: SubscriptionStatus.PAUSED,
    };

    const data: Parameters<typeof this.subscriptionService.updateFromStripe>[1] =
      {
        status: statusMap[sub.status] || SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      };

    // If the plan changed via Stripe, try to update planId
    if (sub.metadata?.planId) {
      data.planId = sub.metadata.planId;
    }

    try {
      await this.subscriptionService.updateFromStripe(sub.id, data);
      this.logger.log(`Subscription ${sub.id} updated — status: ${sub.status}`);
    } catch (error) {
      this.logger.warn(
        `Could not update subscription ${sub.id}: ${error.message}`,
      );
    }
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    try {
      const subscription = await this.subscriptionService.updateFromStripe(
        sub.id,
        { status: SubscriptionStatus.CANCELED },
      );

      // Downgrade org to FREE plan
      const orgId = subscription.orgId;
      const freePlan = await this.prisma.plan.findFirst({
        where: { type: PlanType.FREE, isActive: true },
      });

      if (freePlan) {
        await this.prisma.subscription.create({
          data: {
            orgId,
            planId: freePlan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        // Re-initialize usage with free plan features
        const features = freePlan.features as PlanFeatures | null;
        if (features) {
          await this.usageService.initializeUsage(orgId, features);
        }
      }

      this.logger.log(
        `Subscription ${sub.id} deleted — org ${orgId} downgraded to FREE`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not handle subscription deletion ${sub.id}: ${error.message}`,
      );
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const stripeSubscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription)?.id;

    if (!stripeSubscriptionId) return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Invoice paid but no subscription found for ${stripeSubscriptionId}`,
      );
      return;
    }

    await this.prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        subscriptionId: subscription.id,
        stripeInvoiceId: invoice.id,
        amount: (invoice.amount_paid ?? 0) / 100,
        currency: invoice.currency || 'usd',
        status: 'paid',
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
        periodStart: invoice.period_start
          ? new Date(invoice.period_start * 1000)
          : null,
        periodEnd: invoice.period_end
          ? new Date(invoice.period_end * 1000)
          : null,
      },
      update: {
        amount: (invoice.amount_paid ?? 0) / 100,
        status: 'paid',
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        pdfUrl: invoice.invoice_pdf ?? null,
      },
    });

    this.logger.log(`Invoice ${invoice.id} recorded as paid`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const stripeSubscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription)?.id;

    if (!stripeSubscriptionId) return;

    // Update subscription status to PAST_DUE
    try {
      await this.subscriptionService.updateFromStripe(stripeSubscriptionId, {
        status: SubscriptionStatus.PAST_DUE,
      });
    } catch {
      // Subscription may not exist yet
    }

    // Record the failed invoice
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (subscription) {
      await this.prisma.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          subscriptionId: subscription.id,
          stripeInvoiceId: invoice.id,
          amount: (invoice.amount_due ?? 0) / 100,
          currency: invoice.currency || 'usd',
          status: 'payment_failed',
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          pdfUrl: invoice.invoice_pdf ?? null,
          periodStart: invoice.period_start
            ? new Date(invoice.period_start * 1000)
            : null,
          periodEnd: invoice.period_end
            ? new Date(invoice.period_end * 1000)
            : null,
        },
        update: {
          status: 'payment_failed',
        },
      });
    }

    this.logger.warn(`Invoice ${invoice.id} payment failed`);
  }
}
