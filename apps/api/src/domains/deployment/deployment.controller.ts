import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { CurrentUser } from '../../core/common/decorators';
import { BrandingService } from './branding.service';
import { DomainService } from './domain.service';
import { EmbedService } from './embed.service';
import { EmailDomainService } from './email-domain.service';
import {
  UpdateBrandingDto,
  UpdateLogoDto,
  AddCustomDomainDto,
  UpdateEmbedSettingsDto,
  UpdateAppearanceDto,
  AddEmailDomainDto,
} from './dto';

@Controller('deployment')
export class DeploymentController {
  constructor(
    private readonly brandingService: BrandingService,
    private readonly domainService: DomainService,
    private readonly embedService: EmbedService,
    private readonly emailDomainService: EmailDomainService,
  ) {}

  // ─── Branding ───────────────────────────────────────────────────────

  @Get('branding')
  async getBranding(@CurrentUser('orgId') orgId: string) {
    const branding = await this.brandingService.getBranding(orgId);
    return { branding };
  }

  @Patch('branding')
  async updateBranding(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: UpdateBrandingDto,
  ) {
    const branding = await this.brandingService.updateBranding(orgId, dto);
    return { branding };
  }

  @Patch('branding/logo')
  async updateLogo(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: UpdateLogoDto,
  ) {
    const branding = await this.brandingService.updateLogo(orgId, dto.logoUrl);
    return { branding };
  }

  // ─── Custom Domains ─────────────────────────────────────────────────

  @Get('domains')
  async getDomains(@CurrentUser('orgId') orgId: string) {
    const domains = await this.domainService.getDomains(orgId);
    return { domains };
  }

  @Post('domains')
  async addDomain(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: AddCustomDomainDto,
  ) {
    return this.domainService.addDomain(orgId, dto.fullDomain);
  }

  @Post('domains/:id/verify')
  async verifyDomain(
    @CurrentUser('orgId') orgId: string,
    @Param('id') domainId: string,
  ) {
    return this.domainService.verifyDomain(domainId, orgId);
  }

  @Delete('domains/:id')
  async deleteDomain(
    @CurrentUser('orgId') orgId: string,
    @Param('id') domainId: string,
  ) {
    return this.domainService.deleteDomain(domainId, orgId);
  }

  // ─── Embed Settings ─────────────────────────────────────────────────

  @Get('embed/:chatbotId')
  async getEmbedSettings(
    @CurrentUser('orgId') orgId: string,
    @Param('chatbotId') chatbotId: string,
  ) {
    const embed = await this.embedService.getEmbedSettings(chatbotId, orgId);
    return { embed };
  }

  @Patch('embed/:chatbotId')
  async updateEmbedSettings(
    @CurrentUser('orgId') orgId: string,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: UpdateEmbedSettingsDto,
  ) {
    const embed = await this.embedService.updateEmbedSettings(
      chatbotId,
      orgId,
      dto,
    );
    return { embed };
  }

  @Patch('embed/:chatbotId/appearance')
  async updateAppearance(
    @CurrentUser('orgId') orgId: string,
    @Param('chatbotId') chatbotId: string,
    @Body() dto: UpdateAppearanceDto,
  ) {
    const chatbot = await this.embedService.updateAppearance(
      chatbotId,
      orgId,
      dto.appearance as unknown as Record<string, unknown>,
    );
    return { chatbot };
  }

  @Get('embed/:chatbotId/code')
  async getEmbedCode(@Param('chatbotId') chatbotId: string) {
    const embedCode = this.embedService.generateEmbedCode(chatbotId);
    return { embedCode };
  }

  // ─── Email Domains ──────────────────────────────────────────────────

  @Get('email-domains')
  async getEmailDomains(@CurrentUser('orgId') orgId: string) {
    const emailDomains = await this.emailDomainService.getEmailDomains(orgId);
    return { emailDomains };
  }

  @Post('email-domains')
  async addEmailDomain(
    @CurrentUser('orgId') orgId: string,
    @Body() dto: AddEmailDomainDto,
  ) {
    return this.emailDomainService.addEmailDomain(orgId, dto.domain);
  }

  @Post('email-domains/:id/verify')
  async verifyEmailDomain(
    @CurrentUser('orgId') orgId: string,
    @Param('id') domainId: string,
  ) {
    return this.emailDomainService.verifyEmailDomain(domainId, orgId);
  }

  @Delete('email-domains/:id')
  async deleteEmailDomain(
    @CurrentUser('orgId') orgId: string,
    @Param('id') domainId: string,
  ) {
    return this.emailDomainService.deleteEmailDomain(domainId, orgId);
  }
}
