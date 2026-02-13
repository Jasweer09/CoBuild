import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { UserRole } from '../../generated/prisma';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly OTP_TTL_SECONDS = 600; // 10 minutes
  private readonly REFRESH_TOKEN_TTL_DAYS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  async signup(name: string, email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
    const slug = this.generateOrgSlug(name);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `${name}'s Organization`,
          slug,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: UserRole.OWNER,
          orgId: organization.id,
        },
      });

      return { user, organization };
    });

    const otp = this.generateOtp();
    await this.cacheService.set(`otp:${email}`, otp, this.OTP_TTL_SECONDS);

    const tokens = await this.generateTokens(result.user);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        orgId: result.user.orgId,
        emailVerified: result.user.emailVerified,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      ...tokens,
      verificationCode: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async login(email: string, password: string, ip?: string, deviceInfo?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user, ip, deviceInfo);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }

    // Rotate: delete old, issue new
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await this.generateTokens(stored.user);

    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        name: stored.user.name,
        role: stored.user.role,
        orgId: stored.user.orgId,
        emailVerified: stored.user.emailVerified,
      },
      ...tokens,
    };
  }

  async verifyEmail(email: string, code: string) {
    const stored = await this.cacheService.get<string>(`otp:${email}`);

    if (!stored || stored !== code) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });

    await this.cacheService.del(`otp:${email}`);

    return { verified: true };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return { sent: true };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const otp = this.generateOtp();
    await this.cacheService.set(`otp:${email}`, otp, this.OTP_TTL_SECONDS);

    // TODO: Send email via SES
    return {
      sent: true,
      verificationCode: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    } else {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }

    return { loggedOut: true };
  }

  async handleGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // Link Google account if not already linked
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl || user.avatarUrl,
            emailVerified: true,
          },
        });
      }
    } else {
      // Create new user + org
      const slug = this.generateOrgSlug(profile.name);
      const result = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: `${profile.name}'s Organization`,
            slug,
          },
        });

        return tx.user.create({
          data: {
            name: profile.name,
            email: profile.email,
            googleId: profile.googleId,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
            role: UserRole.OWNER,
            orgId: organization.id,
          },
        });
      });
      user = result;
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Account has been suspended');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  // ─── Private helpers ──────────────────────────────────────

  private async generateTokens(
    user: { id: string; email: string; orgId: string; role: string },
    ip?: string,
    deviceInfo?: string,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.orgId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
    });

    const refreshToken = randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_TTL_DAYS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress: ip,
        deviceInfo,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateOrgSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const suffix = randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }
}
