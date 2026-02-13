import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

/**
 * Shape of the `features` JSON field on the Plan model.
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
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(orgId: string) {
    return this.prisma.featureUsage.findMany({
      where: { orgId },
      orderBy: { featureName: 'asc' },
    });
  }

  async getUsageByFeature(
    orgId: string,
    featureName: string,
    chatbotId?: string,
  ) {
    return this.prisma.featureUsage.findFirst({
      where: {
        orgId,
        featureName,
        chatbotId: chatbotId ?? null,
      },
    });
  }

  async incrementUsage(
    orgId: string,
    featureName: string,
    amount = 1,
    chatbotId?: string,
  ) {
    const usage = await this.prisma.featureUsage.findFirst({
      where: {
        orgId,
        featureName,
        chatbotId: chatbotId ?? null,
      },
    });

    if (!usage) {
      throw new BadRequestException(
        `No usage record found for feature "${featureName}"`,
      );
    }

    return this.prisma.featureUsage.update({
      where: { id: usage.id },
      data: { used: { increment: amount } },
    });
  }

  async checkLimit(
    orgId: string,
    featureName: string,
    chatbotId?: string,
  ): Promise<boolean> {
    const usage = await this.prisma.featureUsage.findFirst({
      where: {
        orgId,
        featureName,
        chatbotId: chatbotId ?? null,
      },
    });

    if (!usage) {
      // No usage record means no limit is configured — allow by default
      return true;
    }

    return usage.used < usage.limit;
  }

  async resetUsage(
    orgId: string,
    featureName: string,
    chatbotId?: string,
  ) {
    const usage = await this.prisma.featureUsage.findFirst({
      where: {
        orgId,
        featureName,
        chatbotId: chatbotId ?? null,
      },
    });

    if (!usage) return null;

    return this.prisma.featureUsage.update({
      where: { id: usage.id },
      data: {
        used: 0,
        resetAt: new Date(),
      },
    });
  }

  async initializeUsage(orgId: string, planFeatures: PlanFeatures) {
    // Delete all existing org-level usage records so we start fresh
    await this.prisma.featureUsage.deleteMany({
      where: { orgId, chatbotId: null },
    });

    const records = Object.entries(planFeatures)
      .filter(([, value]) => typeof value === 'number')
      .map(([featureName, limit]) => ({
        orgId,
        featureName,
        used: 0,
        limit: limit as number,
      }));

    if (records.length === 0) return [];

    await this.prisma.featureUsage.createMany({ data: records });

    return this.prisma.featureUsage.findMany({
      where: { orgId, chatbotId: null },
    });
  }
}
