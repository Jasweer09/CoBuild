import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../core/common/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { WebhookService } from './webhook.service';

/**
 * Stripe Webhook Controller
 *
 * IMPORTANT: This endpoint requires access to the raw request body for
 * Stripe signature verification. You must configure raw body parsing in
 * main.ts for the `/api/billing/webhook` route. For example with NestJS
 * v11 and @nestjs/platform-express:
 *
 *   const app = await NestFactory.create(AppModule, { rawBody: true });
 *
 * Or selectively using middleware:
 *
 *   app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
 *
 * Without this, req.rawBody / req.body will be parsed JSON instead of a
 * Buffer, and Stripe signature verification will fail.
 */
@Controller('billing')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: WebhookService,
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Access the raw body for signature verification.
    // This requires `rawBody: true` in NestFactory.create options or
    // express.raw() middleware on this route.
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      this.logger.error(
        'Raw body not available. Ensure rawBody parsing is configured in main.ts for /api/billing/webhook',
      );
      throw new BadRequestException(
        'Raw body not available for webhook verification',
      );
    }

    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    this.logger.log(`Received Stripe webhook: ${event.type} (${event.id})`);

    const result = await this.webhookService.handleWebhook(event);

    return result;
  }
}
