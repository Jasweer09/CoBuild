import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '../../generated/prisma';
import { CreateChatbotDto, UpdateChatbotDto } from './dto';

@Injectable()
export class ChatbotService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, orgId: string, dto: CreateChatbotDto) {
    const slug = dto.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return this.prisma.chatbot.create({
      data: {
        orgId,
        createdById: userId,
        name: dto.name,
        slug,
        aiModel: dto.aiModel ?? 'gemini-2.5-flash',
        temperature: dto.temperature ?? 0.7,
        systemPrompt: dto.systemPrompt,
        initialMessage: dto.initialMessage,
        suggestedMessages: dto.suggestedMessages ?? [],
        isPublic: dto.isPublic ?? true,
      },
    });
  }

  async findAllByOrg(orgId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [chatbots, total] = await Promise.all([
      this.prisma.chatbot.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { conversations: true },
          },
        },
      }),
      this.prisma.chatbot.count({ where: { orgId } }),
    ]);

    return {
      chatbots,
      totalDocs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  async findById(id: string, orgId: string) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id, orgId },
      include: {
        _count: {
          select: { conversations: true, qnaPairs: true, crawlJobs: true },
        },
      },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    return chatbot;
  }

  async update(id: string, orgId: string, dto: UpdateChatbotDto) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id, orgId },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    const { appearance, ...rest } = dto;
    const data: Prisma.ChatbotUpdateInput = {
      ...rest,
      ...(appearance && { appearance: appearance as Prisma.InputJsonValue }),
      ...(dto.name && {
        slug: dto.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
      }),
    };

    return this.prisma.chatbot.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, orgId: string) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id, orgId },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    await this.prisma.chatbot.delete({ where: { id } });
    return { deleted: true };
  }

  async validateOwnership(chatbotId: string, orgId: string) {
    const chatbot = await this.prisma.chatbot.findFirst({
      where: { id: chatbotId, orgId },
    });

    if (!chatbot) {
      throw new ForbiddenException('Chatbot not found or access denied');
    }

    return chatbot;
  }
}
