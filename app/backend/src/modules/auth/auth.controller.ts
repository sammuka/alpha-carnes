import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';
import { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const secure = this.config.get<boolean>('COOKIE_SECURE') ?? false;
    const opts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
    res.cookie('access_token', accessToken, { ...opts, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...opts, maxAge: 8 * 60 * 60 * 1000 });
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Auditar('LOGIN', 'auth')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { message: 'Login realizado com sucesso', usuario: result.usuario };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente');

    const result = await this.authService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    this.setCookies(res, result.accessToken, result.refreshToken);
    return { message: 'Tokens renovados' };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    if (refreshToken) await this.authService.logout(refreshToken);

    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logout realizado' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }
}
