import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CrawlService } from './crawl.service';

@Processor('crawl-queue')
export class CrawlWorker extends WorkerHost {
  private readonly logger = new Logger(CrawlWorker.name);

  constructor(private readonly crawlService: CrawlService) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    this.logger.log(`Processing crawl job ${job.data.jobId} (attempt ${job.attemptsMade + 1})`);

    try {
      await this.crawlService.processCrawlJob(job.data.jobId);
      this.logger.log(`Crawl job ${job.data.jobId} processed successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Crawl job ${job.data.jobId} failed: ${message}`);
      throw err; // Re-throw so BullMQ can retry
    }
  }
}
