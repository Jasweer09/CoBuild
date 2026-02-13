import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CurrentUser } from '../../core/common/decorators';
import { CrawlService } from './crawl.service';
import { StartCrawlDto, SelectPagesDto } from './dto';

@Controller('knowledge')
export class CrawlController {
  constructor(
    private readonly crawlService: CrawlService,
    @InjectQueue('training-queue') private readonly trainingQueue: Queue,
  ) {}

  @Post('crawl')
  async startCrawl(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: StartCrawlDto,
  ) {
    const job = await this.crawlService.startCrawl(orgId, dto);
    return { job };
  }

  @Get('crawl/:chatbotId')
  async listCrawlJobs(
    @Param('chatbotId') chatbotId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.crawlService.findAllByBot(chatbotId, page, limit);
  }

  @Get('crawl/job/:jobId')
  async getCrawlJob(@Param('jobId') jobId: string) {
    const job = await this.crawlService.findJobById(jobId);
    return { job };
  }

  @Get('crawl/job/:jobId/pages')
  async getCrawledPages(
    @Param('jobId') jobId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.crawlService.getCrawledPages(jobId, page, limit);
  }

  @Get('crawl/job/:jobId/pending')
  async getPendingPages(@Param('jobId') jobId: string) {
    return this.crawlService.getPendingPages(jobId);
  }

  @Post('crawl/job/:jobId/select')
  async selectPages(
    @Param('jobId') jobId: string,
    @Body() dto: SelectPagesDto,
  ) {
    return this.crawlService.selectPages(
      jobId,
      dto.selectedPageIds,
      this.trainingQueue,
    );
  }

  @Post('crawl/job/:jobId/cancel')
  async cancelJob(@Param('jobId') jobId: string) {
    const job = await this.crawlService.cancelJob(jobId);
    return { job };
  }
}
