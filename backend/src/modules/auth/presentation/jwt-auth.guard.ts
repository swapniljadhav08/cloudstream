import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { AppError } from '../../../shared/kernel/errors';
import type { AuthenticatedUser } from '../application/auth.service';

export const IS_PUBLIC = 'auth:isPublic';
export const REQUIRED_ROLES = 'auth:requiredRoles';

/** Marks a route as reachable without a token. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to the given roles (docs/10_User_Roles.md). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);

// Request type augmentation so handlers read req.user without casting.
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

// Applied globally in app.module.ts: routes are protected by default and must
// opt out with @Public(), so a new endpoint cannot be left unauthenticated by
// forgetting a decorator.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets) ?? false;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    // A token is always decoded when one is present, including on @Public()
    // routes. A public route may still behave differently for a signed-in
    // caller -- GET /videos/:id serves public videos to anyone but must also
    // serve a private video to its owner -- and that is impossible if the
    // identity is discarded just because the route is public.
    let payload: JwtPayload | undefined;
    if (bearer) {
      try {
        payload = await this.jwt.verifyAsync<JwtPayload>(bearer);
        req.user = { id: payload.sub, email: payload.email, role: payload.role };
      } catch {
        // On a protected route an unusable token is an error; on a public one
        // it is simply an anonymous request.
        if (!isPublic) {
          throw new AppError('UNAUTHORIZED', 'Token is invalid or expired');
        }
      }
    }

    if (isPublic) {
      return true;
    }

    if (!payload) {
      throw new AppError('UNAUTHORIZED', 'Missing bearer token');
    }

    const required = this.reflector.getAllAndOverride<Role[]>(REQUIRED_ROLES, targets);
    if (required && required.length > 0 && !required.includes(payload.role)) {
      throw new AppError('FORBIDDEN', 'Insufficient role for this operation');
    }

    return true;
  }
}
