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
import { ChatbotService } from './chatbot.service';
import { CreateChatbotDto, UpdateChatbotDto } from './dto';
import { CurrentUser } from '../../core/common/decorators';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateChatbotDto,
  ) {
    const chatbot = await this.chatbotService.create(userId, orgId, dto);
    return { chatbot };
  }

  @Get()
  async findAll(
    @CurrentUser('orgId') orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.chatbotService.findAllByOrg(orgId, page || 1, limit || 20);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('orgId') orgId: string,
  ) {
    const chatbot = await this.chatbotService.findById(id, orgId);
    return { chatbot };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: UpdateChatbotDto,
  ) {
    const chatbot = await this.chatbotService.update(id, orgId, dto);
    return { chatbot };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('orgId') orgId: string,
  ) {
    return this.chatbotService.delete(id, orgId);
  }
}
