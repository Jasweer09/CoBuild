import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PlanType, SubscriptionStatus } from '../../generated/prisma';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrg(orgId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { orgId },
      include: {
        plan: true,
        addons: {
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    return subscription;
  }

  async createFreeSubscription(orgId: string) {
    const freePlan = await this.prisma.plan.findFirst({
      where: { type: PlanType.FREE, isActive: true },
    });

    if (!freePlan) {
      throw new NotFoundException('Free plan not found. Please contact support.');
    }

    // Check if org already has a subscription
    const existing = await this.prisma.subscription.findFirst({
      where: { orgId },
    });

    if (existing) {
      throw new BadRequestException('Organization already has a subscription');
    }

    return this.prisma.subscription.create({
      data: {
        orgId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      include: { plan: true },
    });
  }

  async updateFromStripe(
    stripeSubscriptionId: string,
    data: {
      status?: SubscriptionStatus;
      planId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAt?: Date | null;
      canceledAt?: Date | null;
      trialStart?: Date | null;
      trialEnd?: Date | null;
    },
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with Stripe ID ${stripeSubscriptionId} not found`,
      );
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data,
      include: { plan: true },
    });
  }

  async cancel(orgId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        orgId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    // Set cancelAt to current period end (subscription stays active until then)
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: subscription.currentPeriodEnd,
        canceledAt: new Date(),
      },
      include: { plan: true },
    });
  }

  async reactivate(orgId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        orgId,
        cancelAt: { not: null },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        'No canceled subscription found to reactivate',
      );
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAt: null,
        canceledAt: null,
      },
      include: { plan: true },
    });
  }
}
