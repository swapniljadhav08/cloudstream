import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService, type PublicUser, type TokenPair } from '../application/auth.service';
import { loginSchema, refreshSchema, registerSchema } from './dtos';
import { Public } from './jwt-auth.guard';
import { AuditService } from '../../../shared/infrastructure/audit/audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  async register(@Body() body: unknown, @Req() req: FastifyRequest): Promise<PublicUser> {
    const input = registerSchema.parse(body);
    const user = await this.auth.register(input);
    await this.audit.record(req, { userId: user.id, action: 'auth.register', resource: 'user', resourceId: user.id });
    return user;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: FastifyRequest): Promise<TokenPair> {
    const input = loginSchema.parse(body);
    const tokens = await this.auth.login(input);
    await this.audit.record(req, { action: 'auth.login', resource: 'session' });
    return tokens;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: unknown): Promise<{ accessToken: string; expiresIn: number }> {
    const input = refreshSchema.parse(body);
    return this.auth.refresh(input.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: unknown): Promise<void> {
    const input = refreshSchema.parse(body);
    await this.auth.logout(input.refreshToken);
  }
}
