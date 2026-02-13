import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '../../generated/prisma';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class EmbedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getEmbedSettings(chatbotId: string, orgId: string) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: chatbotId, orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        appearance: true,
        embedAllowedDomains: true,
        isPublic: true,
        passwordHash: true,
      },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    return {
      id: chatbot.id,
      name: chatbot.name,
      slug: chatbot.slug,
      appearance: chatbot.appearance,
      embedAllowedDomains: chatbot.embedAllowedDomains,
      isPublic: chatbot.isPublic,
      passwordProtected: !!chatbot.passwordHash,
    };
  }

  async updateEmbedSettings(
    chatbotId: string,
    orgId: string,
    dto: { embedAllowedDomains?: string[]; passwordProtected?: boolean; password?: string },
  ) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: chatbotId, orgId },
      select: { id: true },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    const data: Prisma.ChatbotUpdateInput = {};

    if (dto.embedAllowedDomains !== undefined) {
      data.embedAllowedDomains = dto.embedAllowedDomains;
    }

    if (dto.passwordProtected === false) {
      data.passwordHash = null;
    } else if (dto.passwordProtected === true && dto.password) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(dto.password, salt);
    }

    const updated = await this.prisma.chatbot.update({
      where: { id: chatbotId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        appearance: true,
        embedAllowedDomains: true,
        isPublic: true,
        passwordHash: true,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      appearance: updated.appearance,
      embedAllowedDomains: updated.embedAllowedDomains,
      isPublic: updated.isPublic,
      passwordProtected: !!updated.passwordHash,
    };
  }

  async updateAppearance(
    chatbotId: string,
    orgId: string,
    appearance: Record<string, unknown>,
  ) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: chatbotId, orgId },
      select: { id: true, appearance: true },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    const existingAppearance =
      chatbot.appearance && typeof chatbot.appearance === 'object'
        ? (chatbot.appearance as Record<string, unknown>)
        : {};

    const mergedAppearance = { ...existingAppearance, ...appearance };

    return this.prisma.chatbot.update({
      where: { id: chatbotId },
      data: {
        appearance: mergedAppearance as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        appearance: true,
        embedAllowedDomains: true,
        isPublic: true,
      },
    });
  }

  generateEmbedCode(chatbotId: string) {
    const appUrl =
      this.configService.get<string>('NEXT_PUBLIC_APP_URL') ||
      'https://app.cobuild.ai';

    const scriptTag = `<script src="${appUrl}/widget.js" data-chatbot-id="${chatbotId}"></script>`;
    const iframeTag = `<iframe src="${appUrl}/widget/${chatbotId}" width="400" height="600" frameborder="0" style="border:none;"></iframe>`;

    return {
      scriptTag,
      iframeTag,
      chatbotId,
      widgetUrl: `${appUrl}/widget/${chatbotId}`,
    };
  }

  async validateEmbedAccess(
    chatbotId: string,
    origin?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        embedAllowedDomains: true,
        isPublic: true,
      },
    });

    if (!chatbot) {
      return { allowed: false, reason: 'Chatbot not found' };
    }

    // Public chatbot with no domain restrictions
    if (
      chatbot.embedAllowedDomains.length === 0 ||
      !origin
    ) {
      return { allowed: true };
    }

    // Check if origin matches any allowed domain
    const normalizedOrigin = origin
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    const isAllowed = chatbot.embedAllowedDomains.some((domain) => {
      const normalizedDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .toLowerCase();
      return (
        normalizedOrigin === normalizedDomain ||
        normalizedOrigin.endsWith(`.${normalizedDomain}`)
      );
    });

    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Origin "${origin}" is not in the allowed domains list`,
      };
    }

    return { allowed: true };
  }
}
