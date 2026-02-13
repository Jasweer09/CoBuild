import {
  Controller,
  Get,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { Public } from '../../core/common/decorators/public.decorator';
import { PrismaService } from '../../core/database/prisma.service';

@Controller('widget')
export class WidgetController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get(':chatbotId/config')
  async getWidgetConfig(@Param('chatbotId') chatbotId: string) {
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        name: true,
        slug: true,
        appearance: true,
        initialMessage: true,
        suggestedMessages: true,
        isPublic: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            branding: true,
          },
        },
      },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot not found');
    }

    return {
      chatbot: {
        id: chatbot.id,
        name: chatbot.name,
        slug: chatbot.slug,
        appearance: chatbot.appearance,
        initialMessage: chatbot.initialMessage,
        suggestedMessages: chatbot.suggestedMessages,
        isPublic: chatbot.isPublic,
      },
      organization: {
        name: chatbot.organization.name,
        logoUrl: chatbot.organization.logoUrl,
        branding: chatbot.organization.branding,
      },
    };
  }
}
