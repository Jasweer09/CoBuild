import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '../../generated/prisma';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        branding: true,
        customDomain: true,
        createdAt: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async findBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        branding: true,
        customDomain: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async updateOrganization(
    orgId: string,
    input: { name?: string; logoUrl?: string; branding?: Record<string, unknown> },
  ) {
    const { branding, ...rest } = input;
    const data: Prisma.OrganizationUpdateInput = {
      ...rest,
      ...(branding && { branding: branding as Prisma.InputJsonValue }),
    };

    return this.prisma.organization.update({
      where: { id: orgId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        branding: true,
        customDomain: true,
      },
    });
  }
}
