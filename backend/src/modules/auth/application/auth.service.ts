import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { AppError } from '../../../shared/kernel/errors';
import { loadConfig } from '../../../config';
import { hashPassword, verifyPassword } from '../domain/password';
import { hashRefreshToken, issueRefreshToken } from '../domain/token';
import { durationToMs, durationToSeconds } from '../../../shared/kernel/duration';
import type { LoginInput, RegisterInput } from '../presentation/dtos';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError('CONFLICT', 'An account with that email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });

    return this.toPublicUser(user);
  }

  async login(input: LoginInput): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    // Same error and roughly the same work whether the account exists or the
    // password is wrong, so the response does not reveal which.
    const passwordOk = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva');

    if (!user || !passwordOk) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password');
    }
    if (!user.isActive || user.deletedAt) {
      throw new AppError('FORBIDDEN', 'This account is disabled');
    }

    return this.issueTokens(user);
  }

  async refresh(rawToken: string): Promise<Omit<TokenPair, 'refreshToken'>> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashRefreshToken(rawToken) },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new AppError('UNAUTHORIZED', 'Refresh token is invalid or expired');
    }

    const { accessToken, expiresIn } = await this.issueAccessToken(stored.user);
    return { accessToken, expiresIn };
  }

  async logout(rawToken: string): Promise<void> {
    // Idempotent: logging out with an already-revoked token is not an error.
    await this.prisma.refreshToken.updateMany({
      where: { token: hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const cfg = loadConfig();
    const { accessToken, expiresIn } = await this.issueAccessToken(user);
    const refresh = issueRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refresh.hash,
        expiresAt: new Date(Date.now() + durationToMs(cfg.JWT_REFRESH_EXPIRES_IN)),
      },
    });

    return { accessToken, refreshToken: refresh.raw, expiresIn };
  }

  private async issueAccessToken(user: User): Promise<{ accessToken: string; expiresIn: number }> {
    const cfg = loadConfig();
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken, expiresIn: durationToSeconds(cfg.JWT_EXPIRES_IN) };
  }

  private toPublicUser(user: User): PublicUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
