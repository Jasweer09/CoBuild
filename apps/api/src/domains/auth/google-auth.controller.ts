import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public } from '../../core/common/decorators';

@Controller('auth/google')
export class GoogleAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Initiates Google OAuth flow
  }

  @Public()
  @Get('callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as {
      googleId: string;
      email: string;
      name: string;
      avatarUrl?: string;
    };

    const result = await this.authService.handleGoogleUser(profile);

    const frontendUrl = this.configService.get<string>(
      'NEXT_PUBLIC_APP_URL',
      'http://localhost:3000',
    );

    // Redirect to frontend with tokens in URL fragment (safe, not sent to server)
    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }
}
