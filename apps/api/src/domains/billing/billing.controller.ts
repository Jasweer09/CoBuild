import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { StripeService } from './stripe.service';
import { CreditService } from './credit.service';
import { UsageService } from './usage.service';
import { PrismaService } from '../../core/database/prisma.service';
import { CurrentUser } from '../../core/common/decorators';
import { Public } from '../../core/common/decorators/public.decorator';
import { CreateCheckoutDto, CreateAddonCheckoutDto } from './dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly planService: PlanService,
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly creditService: CreditService,
    private readonly usageService: UsageService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Plans ──────────────────────────────────────────────────────────

  @Public()
  @Get('plans')
  async getPlans() {
    const plans = await this.planService.findAll();
    return { plans };
  }

  // ─── Subscription ───────────────────────────────────────────────────

  @Get('subscription')
  async getSubscription(@CurrentUser('orgId') orgId: string) {
    const subscription = await this.subscriptionService.findByOrg(orgId);
    return { subscription };
  }

  @Post('subscription/cancel')
  async cancelSubscription(@CurrentUser('orgId') orgId: string) {
    const subscription = await this.subscriptionService.cancel(orgId);
    return { subscription };
  }

  @Post('subscription/reactivate')
  async reactivateSubscription(@CurrentUser('orgId') orgId: string) {
    const subscription = await this.subscriptionService.reactivate(orgId);
    return { subscription };
  }

  // ─── Stripe Checkout & Portal ───────────────────────────────────────

  @Post('checkout')
  async createCheckout(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateCheckoutDto,
    @Headers('origin') origin: string,
  ) {
    const successUrl = `${origin || 'http://localhost:3000'}/billing?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin || 'http://localhost:3000'}/billing?canceled=true`;

    const session = await this.stripeService.createCheckoutSession(
      orgId,
      dto.planId,
      dto.billingPeriod || 'MONTHLY',
      successUrl,
      cancelUrl,
    );

    return { session };
  }

  @Post('portal')
  async createPortalSession(
    @CurrentUser('orgId') orgId: string,
    @Headers('origin') origin: string,
  ) {
    const returnUrl = `${origin || 'http://localhost:3000'}/billing`;
    const session = await this.stripeService.createPortalSession(orgId, returnUrl);
    return { session };
  }

  @Post('checkout/addon')
  async createAddonCheckout(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateAddonCheckoutDto,
    @Headers('origin') origin: string,
  ) {
    const successUrl = `${origin || 'http://localhost:3000'}/billing?addon_session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin || 'http://localhost:3000'}/billing?canceled=true`;

    const session = await this.stripeService.createAddonCheckoutSession(
      orgId,
      dto.planId,
      dto.quantity,
      successUrl,
      cancelUrl,
    );

    return { session };
  }

  // ─── Credits ────────────────────────────────────────────────────────

  @Get('credits')
  async getCredits(@CurrentUser('orgId') orgId: string) {
    const balance = await this.creditService.getBalance(orgId);
    return { balance };
  }

  @Get('credits/transactions')
  async getTransactions(
    @CurrentUser('orgId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.creditService.getTransactions(orgId, page || 1, limit || 20);
  }

  // ─── Usage ──────────────────────────────────────────────────────────

  @Get('usage')
  async getUsage(@CurrentUser('orgId') orgId: string) {
    const usage = await this.usageService.getUsage(orgId);
    return { usage };
  }

  // ─── Invoices ───────────────────────────────────────────────────────

  @Get('invoices')
  async getInvoices(
    @CurrentUser('orgId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const take = limit || 20;
    const skip = ((page || 1) - 1) * take;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          subscription: { orgId },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count({
        where: {
          subscription: { orgId },
        },
      }),
    ]);

    return {
      invoices,
      totalDocs: total,
      totalPages: Math.ceil(total / take),
      currentPage: page || 1,
      limit: take,
      hasNextPage: (page || 1) < Math.ceil(total / take),
      hasPrevPage: (page || 1) > 1,
    };
  }
}
