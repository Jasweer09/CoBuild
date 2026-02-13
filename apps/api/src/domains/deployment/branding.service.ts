import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '../../generated/prisma';
import { UpdateBrandingDto } from './dto';

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranding(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        branding: true,
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async updateBranding(orgId: string, dto: UpdateBrandingDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, branding: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const existingBranding =
      org.branding && typeof org.branding === 'object'
        ? (org.branding as Record<string, unknown>)
        : {};

    const mergedBranding = {
      ...existingBranding,
      ...(dto.primaryColor !== undefined && {
        primaryColor: dto.primaryColor,
      }),
      ...(dto.secondaryColor !== undefined && {
        secondaryColor: dto.secondaryColor,
      }),
      ...(dto.fontFamily !== undefined && { fontFamily: dto.fontFamily }),
      ...(dto.customCss !== undefined && { customCss: dto.customCss }),
    };

    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        branding: mergedBranding as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        branding: true,
      },
    });
  }

  async updateLogo(orgId: string, logoUrl: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        branding: true,
      },
    });
  }
}
