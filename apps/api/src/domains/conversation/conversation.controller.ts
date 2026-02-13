import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { CreateConversationDto, UpdateConversationDto } from './dto';
import { CurrentUser } from '../../core/common/decorators';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.conversationService.create(
      userId,
      orgId,
      dto,
    );
    return { conversation };
  }

  @Get('bot/:chatbotId')
  async findAllByBot(
    @Param('chatbotId') chatbotId: string,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.conversationService.findAllByBot(
      chatbotId,
      orgId,
      userId,
      page || 1,
      limit || 20,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const conversation = await this.conversationService.findById(id, userId);
    return { conversation };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    const conversation = await this.conversationService.update(
      id,
      userId,
      dto,
    );
    return { conversation };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.conversationService.delete(id, userId);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    const messages = await this.conversationService.getMessages(id, userId);
    return { messages };
  }
}
