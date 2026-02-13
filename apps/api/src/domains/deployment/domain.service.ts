import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class DomainService {
  constructor(private readonly prisma: PrismaService) {}

  async addDomain(orgId: string, fullDomain: string) {
    // Check if domain already exists
    const existing = await this.prisma.customDomain.findUnique({
      where: { fullDomain },
    });

    if (existing) {
      throw new ConflictException(
        'This domain is already registered. If you own it, please contact support.',
      );
    }

    // Get org slug for CNAME target
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const cnameTarget = `${org.slug}.cobuild.app`;

    const domain = await this.prisma.customDomain.create({
      data: {
        orgId,
        fullDomain,
        cnameTarget,
        status: 'PENDING',
      },
    });

    return {
      domain,
      dnsInstructions: {
        type: 'CNAME',
        host: fullDomain,
        value: cnameTarget,
        note: `Add a CNAME record pointing "${fullDomain}" to "${cnameTarget}". DNS propagation may take up to 48 hours.`,
      },
    };
  }

  async getDomains(orgId: string) {
    return this.prisma.customDomain.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyDomain(domainId: string, orgId: string) {
    const domain = await this.prisma.customDomain.findFirst({
      where: { id: domainId, orgId },
    });

    if (!domain) {
      throw new NotFoundException('Custom domain not found');
    }

    if (domain.status === 'ACTIVE') {
      return { domain, message: 'Domain is already verified and active.' };
    }

    // In production this would perform a real DNS lookup to verify the CNAME.
    // For now, we simulate verification by transitioning the status.
    const updatedDomain = await this.prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: 'VERIFYING',
      },
    });

    // Simulate async verification: mark as ACTIVE
    // In production, this would be handled by a background job or webhook
    // after confirming the DNS record resolves correctly.
    const verifiedDomain = await this.prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: 'ACTIVE',
        verifiedAt: new Date(),
      },
    });

    // Also update the org's customDomain field
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { customDomain: domain.fullDomain },
    });

    return {
      domain: verifiedDomain,
      message: 'Domain has been verified and is now active.',
    };
  }

  async deleteDomain(domainId: string, orgId: string) {
    const domain = await this.prisma.customDomain.findFirst({
      where: { id: domainId, orgId },
    });

    if (!domain) {
      throw new NotFoundException('Custom domain not found');
    }

    await this.prisma.customDomain.delete({ where: { id: domainId } });

    // If this was the org's active custom domain, clear it
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { customDomain: true },
    });

    if (org?.customDomain === domain.fullDomain) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { customDomain: null },
      });
    }

    return { deleted: true };
  }
}
