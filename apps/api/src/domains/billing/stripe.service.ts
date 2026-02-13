import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import { BillingPeriod } from '../../generated/prisma';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not configured. Stripe operations will fail.',
      );
    }

    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-02-24.acacia',
    });

    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  async createCustomer(orgId: string, email: string, name: string) {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { orgId },
    });

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customer.id },
    });

    return customer;
  }

  async createCheckoutSession(
    orgId: string,
    planId: string,
    billingPeriod: BillingPeriod,
    successUrl: string,
    cancelUrl: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const priceId =
      billingPeriod === BillingPeriod.YEARLY
        ? plan.stripeYearlyPriceId
        : plan.stripeMonthlyPriceId;

    if (!priceId) {
      throw new BadRequestException(
        `No Stripe price configured for ${billingPeriod.toLowerCase()} billing`,
      );
    }

    // Ensure org has a Stripe customer
    let stripeCustomerId = org.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.createCustomer(orgId, '', org.name);
      stripeCustomerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orgId,
        planId,
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          orgId,
          planId,
          billingPeriod,
        },
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  async createPortalSession(orgId: string, returnUrl: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org?.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer found for this organization. Please subscribe to a plan first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async createAddonCheckoutSession(
    orgId: string,
    addonPlanId: string,
    quantity: number,
    successUrl: string,
    cancelUrl: string,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org?.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer found. Please subscribe to a plan first.',
      );
    }

    const addonPlan = await this.prisma.plan.findUnique({
      where: { id: addonPlanId },
    });

    if (!addonPlan) {
      throw new BadRequestException('Add-on plan not found');
    }

    const priceId = addonPlan.stripeMonthlyPriceId;
    if (!priceId) {
      throw new BadRequestException('No Stripe price configured for this add-on');
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: org.stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orgId,
        addonPlanId,
        quantity: String(quantity),
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
