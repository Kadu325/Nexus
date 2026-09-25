import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, Public } from '../common/auth-context';
import { CSRF_COOKIE, SESSION_COOKIE, config } from '../common/config';
import { hashPassword, newToken, sha256, validateNewPassword, verifyPassword } from '../common/security';
import { ZodPipe } from '../common/validation';
import { LoginLimiter } from './login-limiter';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(256),
});
const changeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});
const switchSchema = z.object({ orgId: z.string().uuid() });

const GENERIC_FAIL = 'Usuário ou senha inválidos.';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  private readonly limiter = new LoginLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private setCookies(res: Response, token: string, expires: Date) {
    const base = { secure: config.cookieSecure, sameSite: 'lax' as const, path: '/', expires };
    res.cookie(SESSION_COOKIE, token, { ...base, httpOnly: true });
    // cookie legível pelo frontend apenas para o padrão double submit contra CSRF
    res.cookie(CSRF_COOKIE, newToken(24), { ...base, httpOnly: false });
  }

  private clearCookies(res: Response) {
    const base = { secure: config.cookieSecure, sameSite: 'lax' as const, path: '/' };
    res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true });
    res.clearCookie(CSRF_COOKIE, base);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const username = body.username.toLowerCase();
    const ip = req.ip ?? 'desconhecido';
    const userKey = `u:${username}`;
    const ipKey = `ip:${ip}`;
    if (this.limiter.isLocked([userKey, ipKey])) {
      await this.audit.log({ ip }, 'LOGIN_BLOQUEADO', 'Sessao', null, { username });
      throw new HttpException(
        { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { username } });
    const ok = await verifyPassword(user?.active ? user.passwordHash : null, body.password);
    const membership = ok
      ? await this.prisma.membership.findFirst({ where: { userId: user!.id }, orderBy: { createdAt: 'asc' } })
      : null;

    if (!ok || !user || !membership) {
      this.limiter.registerFailure(userKey, ipKey);
      await this.audit.log({ ip, orgId: membership?.orgId }, 'LOGIN_FALHA', 'Sessao', null, { username });
      throw new UnauthorizedException(GENERIC_FAIL);
    }
    this.limiter.reset(userKey);

    const token = newToken();
    const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3_600_000);
    const session = await this.prisma.session.create({
      data: {
        tokenHash: sha256(token),
        userId: user.id,
        orgId: membership.orgId,
        expiresAt,
        ip,
        userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300),
      },
    });
    this.setCookies(res, token, expiresAt);
    await this.audit.log({ userId: user.id, orgId: membership.orgId, ip }, 'LOGIN_OK', 'Sessao', session.id);
    return this.me({ userId: user.id, orgId: membership.orgId } as AuthCtx);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Auth() auth: AuthCtx, @Res({ passthrough: true }) res: Response) {
    await this.prisma.session.update({ where: { id: auth.sessionId }, data: { revokedAt: new Date() } });
    this.clearCookies(res);
    await this.audit.log(auth, 'LOGOUT', 'Sessao', auth.sessionId);
  }

  @Get('me')
  async me(@Auth() auth: AuthCtx) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      include: { memberships: { include: { org: true } } },
    });
    const current = user.memberships.find((m) => m.orgId === auth.orgId)!;
    return {
      user: { id: user.id, username: user.username, name: user.name, email: user.email },
      role: current.role,
      organization: {
        id: current.org.id,
        name: current.org.name,
        timezone: current.org.timezone,
        currency: current.org.currency,
        locale: current.org.locale,
      },
      organizations: user.memberships.map((m) => ({ id: m.org.id, name: m.org.name, role: m.role })),
    };
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@Auth() auth: AuthCtx, @Body(new ZodPipe(changeSchema)) body: z.infer<typeof changeSchema>) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      await this.audit.log(auth, 'SENHA_ALTERACAO_FALHA', 'Usuario', auth.userId);
      throw new BadRequestException('Senha atual incorreta.');
    }
    const problem = validateNewPassword(body.newPassword);
    if (problem) throw new BadRequestException(problem);
    if (body.newPassword === body.currentPassword) throw new BadRequestException('A nova senha deve ser diferente da atual.');
    const hash = await hashPassword(body.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: auth.userId }, data: { passwordHash: hash, passwordChangedAt: new Date() } }),
      // encerra as demais sessões do usuário
      this.prisma.session.updateMany({
        where: { userId: auth.userId, revokedAt: null, id: { not: auth.sessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log(auth, 'SENHA_ALTERADA', 'Usuario', auth.userId);
  }

  @Post('switch-organization')
  @HttpCode(200)
  async switchOrg(@Auth() auth: AuthCtx, @Body(new ZodPipe(switchSchema)) body: z.infer<typeof switchSchema>) {
    const m = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId: auth.userId, orgId: body.orgId } } });
    if (!m) throw new ForbiddenException('Você não tem vínculo com essa organização.');
    await this.prisma.session.update({ where: { id: auth.sessionId }, data: { orgId: body.orgId } });
    await this.audit.log({ ...auth, orgId: body.orgId }, 'TROCA_ORGANIZACAO', 'Sessao', auth.sessionId, { from: auth.orgId });
    return this.me({ ...auth, orgId: body.orgId });
  }
}
