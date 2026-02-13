import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CurrentUser } from '../../core/common/decorators';
import { TrainingStatus } from '../../generated/prisma';
import { QnaService } from './qna.service';
import { CreateQnaDto, BulkCreateQnaDto, UpdateQnaDto } from './dto';

@Controller('knowledge')
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Post('qna')
  async create(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: CreateQnaDto,
  ) {
    const qna = await this.qnaService.create(orgId, dto);
    return { qna };
  }

  @Post('qna/bulk')
  async bulkCreate(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: BulkCreateQnaDto,
  ) {
    return this.qnaService.bulkCreate(orgId, dto);
  }

  @Get('qna/:chatbotId')
  async findAll(
    @Param('chatbotId') chatbotId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: TrainingStatus,
  ) {
    return this.qnaService.findAllByBot(chatbotId, page, limit, search, status);
  }

  @Get('qna/:qnaId/detail')
  async findOne(@Param('qnaId') qnaId: string) {
    const qna = await this.qnaService.findById(qnaId);
    return { qna };
  }

  @Patch('qna/:qnaId')
  async update(
    @Param('qnaId') qnaId: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: UpdateQnaDto,
  ) {
    const qna = await this.qnaService.update(qnaId, orgId, dto);
    return { qna };
  }

  @Delete('qna/:qnaId')
  async remove(
    @Param('qnaId') qnaId: string,
    @CurrentUser('orgId') orgId: string,
  ) {
    return this.qnaService.delete(qnaId, orgId);
  }
}
