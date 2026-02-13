import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { CurrentUser } from '../../core/common/decorators';
import { TextTrainingService } from './text-training.service';
import { UpsertTextTrainingDto } from './dto';

@Controller('knowledge')
export class TextTrainingController {
  constructor(private readonly textTrainingService: TextTrainingService) {}

  @Post('text')
  async upsert(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: UpsertTextTrainingDto,
  ) {
    const textTraining = await this.textTrainingService.upsert(orgId, dto);
    return { textTraining };
  }

  @Get('text/:chatbotId')
  async findByBot(@Param('chatbotId') chatbotId: string) {
    const textTraining = await this.textTrainingService.findByBot(chatbotId);
    return { textTraining };
  }

  @Delete('text/:chatbotId')
  async remove(
    @Param('chatbotId') chatbotId: string,
    @CurrentUser('orgId') orgId: string,
  ) {
    return this.textTrainingService.delete(chatbotId, orgId);
  }
}
