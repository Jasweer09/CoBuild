import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as cheerio from 'cheerio';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { CrawlStatus, PageType } from '../../generated/prisma';
import { ChatbotService } from '../chatbot/chatbot.service';
import { StartCrawlDto } from './dto';

@Injectable()
export class CrawlService {
  private readonly logger = new Logger(CrawlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbotService: ChatbotService,
    @InjectQueue('crawl-queue') private readonly crawlQueue: Queue,
  ) {}

  /**
   * Start a new crawl job. Validates chatbot ownership, creates the
   * CrawlJob record, and enqueues it for background processing.
   */
  async startCrawl(orgId: string, dto: StartCrawlDto) {
    await this.chatbotService.validateOwnership(dto.chatbotId, orgId);

    const job = await this.prisma.crawlJob.create({
      data: {
        chatbotId: dto.chatbotId,
        url: dto.url,
        maxDepth: dto.maxDepth ?? -1,
        confirmedLimit: dto.confirmedLimit,
        status: CrawlStatus.QUEUED,
      },
    });

    await this.crawlQueue.add('crawl', { jobId: job.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    this.logger.log(`Crawl job ${job.id} queued for ${dto.url}`);
    return job;
  }

  /**
   * Return a paginated list of crawl jobs for a given chatbot.
   */
  async findAllByBot(chatbotId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.prisma.crawlJob.findMany({
        where: { chatbotId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { crawledPages: true } },
        },
      }),
      this.prisma.crawlJob.count({ where: { chatbotId } }),
    ]);

    return {
      jobs,
      totalDocs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  /**
   * Retrieve a single crawl job by ID with aggregate page counts.
   */
  async findJobById(jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: {
        _count: { select: { crawledPages: true } },
      },
    });

    if (!job) {
      throw new NotFoundException('Crawl job not found');
    }

    return job;
  }

  /**
   * Paginated list of crawled pages for a given job.
   */
  async getCrawledPages(jobId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [pages, total] = await Promise.all([
      this.prisma.crawledPage.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.crawledPage.count({ where: { jobId } }),
    ]);

    return {
      pages,
      totalDocs: total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
  }

  /**
   * Get pages that have been successfully crawled but not yet selected
   * for training. These are presented to the user for review.
   */
  async getPendingPages(jobId: string) {
    const pages = await this.prisma.crawledPage.findMany({
      where: {
        jobId,
        status: CrawlStatus.COMPLETED,
        isSelected: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    return { pages, count: pages.length };
  }

  /**
   * Mark specific crawled pages as selected and enqueue them for
   * embedding/training.
   */
  async selectPages(
    jobId: string,
    selectedPageIds: string[],
    trainingQueue: Queue,
  ) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Crawl job not found');
    }

    // Verify all pages belong to this job
    const pages = await this.prisma.crawledPage.findMany({
      where: {
        id: { in: selectedPageIds },
        jobId,
      },
    });

    if (pages.length !== selectedPageIds.length) {
      throw new BadRequestException(
        'One or more page IDs do not belong to this crawl job',
      );
    }

    // Mark as selected
    await this.prisma.crawledPage.updateMany({
      where: { id: { in: selectedPageIds } },
      data: { isSelected: true },
    });

    // Enqueue each page for training
    for (const page of pages) {
      await trainingQueue.add(
        'train',
        {
          type: 'crawl-page',
          chatbotId: job.chatbotId,
          sourceId: page.id,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    this.logger.log(
      `Selected ${pages.length} pages from job ${jobId} for training`,
    );

    return { selectedCount: pages.length };
  }

  /**
   * Cancel a crawl job that is still in progress.
   */
  async cancelJob(jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Crawl job not found');
    }

    if (
      job.status === CrawlStatus.COMPLETED ||
      job.status === CrawlStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel a job with status ${job.status}`,
      );
    }

    const updated = await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: CrawlStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    this.logger.log(`Crawl job ${jobId} cancelled`);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Internal: called by the CrawlWorker
  // ---------------------------------------------------------------------------

  /**
   * Crawl the target URL: fetch HTML, extract text and links, then
   * recursively crawl discovered links up to maxDepth / confirmedLimit.
   */
  async processCrawlJob(jobId: string): Promise<void> {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      this.logger.error(`Crawl job ${jobId} not found`);
      return;
    }

    if (job.status === CrawlStatus.CANCELLED) {
      this.logger.warn(`Crawl job ${jobId} was cancelled, skipping`);
      return;
    }

    await this.prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: CrawlStatus.PROCESSING, startedAt: new Date() },
    });

    const visited = new Set<string>();
    const limit = job.confirmedLimit ?? 50;
    const maxDepth = job.maxDepth === -1 ? Infinity : job.maxDepth;
    let pagesFound = 0;
    let pagesCrawled = 0;
    let pagesFailed = 0;

    interface CrawlItem {
      url: string;
      depth: number;
    }

    const queue: CrawlItem[] = [{ url: job.url, depth: 0 }];

    try {
      while (queue.length > 0 && pagesCrawled < limit) {
        // Re-check for cancellation periodically
        if (pagesCrawled > 0 && pagesCrawled % 10 === 0) {
          const current = await this.prisma.crawlJob.findUnique({
            where: { id: jobId },
            select: { status: true },
          });
          if (current?.status === CrawlStatus.CANCELLED) {
            this.logger.log(`Crawl job ${jobId} cancelled mid-crawl`);
            break;
          }
        }

        const item = queue.shift()!;
        const normalizedUrl = this.normalizeUrl(item.url);

        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        pagesFound++;

        try {
          const response = await fetch(normalizedUrl, {
            headers: {
              'User-Agent':
                'CoBuild-Crawler/1.0 (+https://cobuild.ai/bot)',
              Accept: 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(15_000),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            this.logger.debug(`Skipping non-HTML page: ${normalizedUrl}`);
            continue;
          }

          const html = await response.text();
          const $ = cheerio.load(html);

          // Remove non-content elements
          $(
            'script, style, nav, footer, header, noscript, iframe, svg',
          ).remove();

          const title =
            $('title').first().text().trim() ||
            $('h1').first().text().trim() ||
            null;

          const textContent = $('body')
            .text()
            .replace(/\s+/g, ' ')
            .trim();

          if (!textContent) {
            this.logger.debug(`No text content on ${normalizedUrl}`);
            continue;
          }

          const contentHash = createHash('sha256')
            .update(textContent)
            .digest('hex');

          // Store the crawled page
          await this.prisma.crawledPage.create({
            data: {
              id: randomUUID(),
              jobId,
              url: normalizedUrl,
              title,
              pageType: PageType.HTML,
              status: CrawlStatus.COMPLETED,
              storagePath: textContent, // store text content directly
              contentHash,
            },
          });

          pagesCrawled++;

          // Update job counters periodically
          if (pagesCrawled % 5 === 0) {
            await this.prisma.crawlJob.update({
              where: { id: jobId },
              data: { pagesFound, pagesCrawled, pagesFailed },
            });
          }

          // Extract links for further crawling if within depth
          if (item.depth < maxDepth && pagesCrawled < limit) {
            const baseUrl = new URL(normalizedUrl);
            $('a[href]').each((_, el) => {
              try {
                const href = $(el).attr('href');
                if (!href) return;

                const resolved = new URL(href, normalizedUrl);
                // Only crawl same-origin links
                if (resolved.origin !== baseUrl.origin) return;
                // Skip anchors, mailto, tel, javascript
                if (
                  resolved.protocol !== 'http:' &&
                  resolved.protocol !== 'https:'
                )
                  return;

                // Remove hash fragments
                resolved.hash = '';
                const resolvedStr = resolved.toString();

                if (!visited.has(this.normalizeUrl(resolvedStr))) {
                  queue.push({ url: resolvedStr, depth: item.depth + 1 });
                }
              } catch {
                // Invalid URL, skip
              }
            });
          }
        } catch (err) {
          pagesFailed++;
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';

          await this.prisma.crawledPage.create({
            data: {
              id: randomUUID(),
              jobId,
              url: normalizedUrl,
              pageType: PageType.HTML,
              status: CrawlStatus.FAILED,
              errorMessage,
            },
          });

          this.logger.warn(
            `Failed to crawl ${normalizedUrl}: ${errorMessage}`,
          );
        }
      }

      await this.prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: CrawlStatus.COMPLETED,
          pagesFound,
          pagesCrawled,
          pagesFailed,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Crawl job ${jobId} completed: ${pagesCrawled} pages crawled, ${pagesFailed} failed`,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';

      await this.prisma.crawlJob.update({
        where: { id: jobId },
        data: {
          status: CrawlStatus.FAILED,
          pagesFound,
          pagesCrawled,
          pagesFailed,
          errorMessage,
          completedAt: new Date(),
        },
      });

      this.logger.error(`Crawl job ${jobId} failed: ${errorMessage}`);
      throw err;
    }
  }

  /**
   * Normalize a URL by removing trailing slashes and lowercasing the host.
   */
  private normalizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      parsed.hash = '';
      // Remove trailing slash for consistency (unless it's just the root)
      let str = parsed.toString();
      if (str.endsWith('/') && parsed.pathname !== '/') {
        str = str.slice(0, -1);
      }
      return str;
    } catch {
      return rawUrl;
    }
  }
}
