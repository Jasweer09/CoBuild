import { Module } from '@nestjs/common';
import { DeploymentController } from './deployment.controller';
import { WidgetController } from './widget.controller';
import { BrandingService } from './branding.service';
import { DomainService } from './domain.service';
import { EmbedService } from './embed.service';
import { EmailDomainService } from './email-domain.service';

@Module({
  controllers: [DeploymentController, WidgetController],
  providers: [
    BrandingService,
    DomainService,
    EmbedService,
    EmailDomainService,
  ],
  exports: [EmbedService],
})
export class DeploymentModule {}
