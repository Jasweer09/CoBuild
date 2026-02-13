import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../core/common/decorators';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.userService.findById(userId);
  }

  @Get('team')
  async getTeam(@CurrentUser('orgId') orgId: string) {
    return this.userService.findByOrgId(orgId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string; avatarUrl?: string },
  ) {
    return this.userService.updateProfile(userId, body);
  }
}
