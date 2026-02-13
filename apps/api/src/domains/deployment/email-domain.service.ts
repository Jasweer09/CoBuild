import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class EmailDomainService {
  constructor(private readonly prisma: PrismaService) {}

  async addEmailDomain(orgId: string, domain: string) {
    // Check if domain already exists
    const existing = await this.prisma.emailDomain.findUnique({
      where: { domain },
    });

    if (existing) {
      throw new ConflictException(
        'This email domain is already registered.',
      );
    }

    // Generate mock DKIM tokens (in production these would come from AWS SES)
    const dkimTokens = [
      randomBytes(16).toString('hex'),
      randomBytes(16).toString('hex'),
      randomBytes(16).toString('hex'),
    ];

    const emailDomain = await this.prisma.emailDomain.create({
      data: {
        orgId,
        domain,
        dkimTokens,
        isVerified: false,
      },
    });

    return {
      emailDomain,
      dnsRecords: dkimTokens.map((token, index) => ({
        type: 'CNAME',
        host: `${token}._domainkey.${domain}`,
        value: `${token}.dkim.amazonses.com`,
        note: `DKIM record ${index + 1} of 3 — add this CNAME to your DNS.`,
      })),
    };
  }

  async getEmailDomains(orgId: string) {
    return this.prisma.emailDomain.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async verifyEmailDomain(domainId: string, orgId: string) {
    const emailDomain = await this.prisma.emailDomain.findFirst({
      where: { id: domainId, orgId },
    });

    if (!emailDomain) {
      throw new NotFoundException('Email domain not found');
    }

    if (emailDomain.isVerified) {
      return {
        emailDomain,
        message: 'Email domain is already verified.',
      };
    }

    // In production this would check SES identity verification status.
    // For now, simulate verification by marking as verified.
    const verified = await this.prisma.emailDomain.update({
      where: { id: domainId },
      data: { isVerified: true },
    });

    return {
      emailDomain: verified,
      message: 'Email domain has been verified successfully.',
    };
  }

  async deleteEmailDomain(domainId: string, orgId: string) {
    const emailDomain = await this.prisma.emailDomain.findFirst({
      where: { id: domainId, orgId },
    });

    if (!emailDomain) {
      throw new NotFoundException('Email domain not found');
    }

    await this.prisma.emailDomain.delete({ where: { id: domainId } });

    return { deleted: true };
  }
}
