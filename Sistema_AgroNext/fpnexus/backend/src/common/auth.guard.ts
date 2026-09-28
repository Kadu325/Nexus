import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, config } from './config';
import { IS_PUBLIC, ROLES } from './auth-context';
import { safeEqual, sha256 } from './security';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guarda global: toda rota exige sessão válida, salvo @Public().
 * Valida sessão no banco (revogável), expiração absoluta e por inatividade, vínculo com a organização,
 * token CSRF (double submit) em mutações e papel exigido pela rota.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const handlers = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, handlers)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException('Sessão ausente.');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.user.active) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    if (now.getTime() - session.lastSeenAt.getTime() > config.sessionIdleMinutes * 60_000) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: now } });
      throw new UnauthorizedException('Sessão expirada por inatividade.');
    }
    const membership = await this.prisma.membership.findUnique({
      where: { userId_orgId: { userId: session.userId, orgId: session.orgId } },
    });
    if (!membership) throw new UnauthorizedException('Vínculo com a organização removido.');

    if (!SAFE_METHODS.has(req.method)) {
      const header = req.headers[CSRF_HEADER];
      const cookie = req.cookies?.[CSRF_COOKIE];
      if (typeof header !== 'string' || typeof cookie !== 'string' || !safeEqual(header, cookie)) {
        throw new ForbiddenException('Token CSRF ausente ou inválido.');
      }
    }

    if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    req.auth = {
      userId: session.userId,
      orgId: session.orgId,
      role: membership.role,
      sessionId: session.id,
      username: session.user.username,
      name: session.user.name,
      ip: req.ip,
    };

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, handlers);
    if (roles && !roles.includes(membership.role)) {
      throw new ForbiddenException('Seu papel não permite esta operação.');
    }
    return true;
  }
}
