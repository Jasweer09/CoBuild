import { Body, Controller, Get, Patch } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CurrentUser, Roles } from '../../core/common/decorators';
import { UserRole } from '../../generated/prisma';

@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  async getCurrentOrg(@CurrentUser('orgId') orgId: string) {
    return this.tenantService.findById(orgId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateOrg(
    @CurrentUser('orgId') orgId: string,
    @Body() body: { name?: string; logoUrl?: string; branding?: Record<string, unknown> },
  ) {
    return this.tenantService.updateOrganization(orgId, body);
  }
}
