import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, R, Roles } from '../common/auth-context';
import { ZodPipe, zOptDate } from '../common/validation';
import { hashPassword, validateNewPassword } from '../common/security';

const ROLES = ['ADMIN', 'PMO', 'GERENTE', 'MEMBRO', 'LEITOR'] as const;

const createUser = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,50}$/, 'Use de 3 a 50 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.'),
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email('E-mail inválido.').max(200).nullable().optional(),
  role: z.enum(ROLES),
  /** Sem senha: pessoa cadastrada para atribuições, sem acesso ao sistema. */
  password: z.string().max(256).nullable().optional(),
});
const updateUser = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  role: z.enum(ROLES).optional(),
});
const resetPwd = z.object({ newPassword: z.string().min(1).max(256) });
const orgSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('pt-BR', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Fuso horário inválido.')
    .optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  riskAppetite: z.coerce.number().int().min(1).max(25).optional(),
  aiDailyLimit: z.coerce.number().int().min(0).max(100000).optional(),
  timesheetLockedUntil: zOptDate,
});

@ApiTags('Administração')
@Controller()
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Pessoas da organização para seletores de responsável (todos os papéis). */
  @Get('members')
  async members(@Auth() auth: AuthCtx) {
    const ms = await this.prisma.membership.findMany({
      where: { orgId: auth.orgId, user: { active: true } },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });
    return ms.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role }));
  }

  @Get('admin/users')
  @Roles(...R.PMO)
  async users(@Auth() auth: AuthCtx) {
    const ms = await this.prisma.membership.findMany({
      where: { orgId: auth.orgId },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });
    return ms.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      active: m.user.active,
      canLogin: !!m.user.passwordHash,
      createdAt: m.user.createdAt,
    }));
  }

  @Post('admin/users')
  @Roles(...R.ADMIN)
  async createUser(@Auth() auth: AuthCtx, @Body(new ZodPipe(createUser)) body: z.infer<typeof createUser>) {
    if (await this.prisma.user.findUnique({ where: { username: body.username } })) {
      throw new ConflictException('Nome de usuário indisponível.');
    }
    let passwordHash: string | null = null;
    if (body.password) {
      const problem = validateNewPassword(body.password);
      if (problem) throw new BadRequestException(problem);
      passwordHash = await hashPassword(body.password);
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { username: body.username, name: body.name, email: body.email ?? null, passwordHash },
      });
      await tx.membership.create({ data: { userId: u.id, orgId: auth.orgId, role: body.role } });
      await this.audit.log(auth, 'CRIAR', 'Usuario', u.id, { username: u.username, role: body.role, acesso: !!passwordHash }, tx);
      return u;
    });
    return { id: user.id, username: user.username, name: user.name, role: body.role };
  }

  private async membership(auth: AuthCtx, userId: string) {
    const m = await this.prisma.membership.findUnique({ where: { userId_orgId: { userId, orgId: auth.orgId } } });
    if (!m) throw new NotFoundException('Usuário não encontrado nesta organização.');
    return m;
  }

  private async ensureAnotherAdmin(auth: AuthCtx, userId: string) {
    const admins = await this.prisma.membership.count({ where: { orgId: auth.orgId, role: 'ADMIN', userId: { not: userId } } });
    if (admins === 0) throw new ConflictException('A organização precisa manter ao menos um administrador.');
  }

  @Patch('admin/users/:id')
  @Roles(...R.ADMIN)
  async updateUser(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateUser)) body: z.infer<typeof updateUser>) {
    const m = await this.membership(auth, id);
    if (body.role && body.role !== 'ADMIN' && m.role === 'ADMIN') await this.ensureAnotherAdmin(auth, id);
    await this.prisma.$transaction(async (tx) => {
      if (body.role) await tx.membership.update({ where: { id: m.id }, data: { role: body.role } });
      if (body.name || body.email !== undefined) {
        await tx.user.update({ where: { id }, data: { name: body.name, email: body.email } });
      }
      await this.audit.log(auth, 'ALTERAR', 'Usuario', id, body, tx);
    });
    return { ok: true };
  }

  @Post('admin/users/:id/reset-password')
  @HttpCode(204)
  @Roles(...R.ADMIN)
  async resetPassword(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(resetPwd)) body: z.infer<typeof resetPwd>) {
    await this.membership(auth, id);
    const others = await this.prisma.membership.count({ where: { userId: id, orgId: { not: auth.orgId } } });
    if (others > 0) throw new ConflictException('Usuário vinculado a outras organizações: a senha só pode ser redefinida por ele.');
    const problem = validateNewPassword(body.newPassword);
    if (problem) throw new BadRequestException(problem);
    const hash = await hashPassword(body.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash: hash, passwordChangedAt: new Date() } }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log(auth, 'SENHA_REDEFINIDA', 'Usuario', id);
  }

  /** Remove o acesso à organização e encerra as sessões do usuário nela. */
  @Delete('admin/users/:id')
  @HttpCode(204)
  @Roles(...R.ADMIN)
  async removeMembership(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const m = await this.membership(auth, id);
    if (id === auth.userId) throw new ConflictException('Você não pode remover o seu próprio acesso.');
    if (m.role === 'ADMIN') await this.ensureAnotherAdmin(auth, id);
    await this.prisma.$transaction([
      this.prisma.membership.delete({ where: { id: m.id } }),
      this.prisma.session.updateMany({ where: { userId: id, orgId: auth.orgId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log(auth, 'REMOVER_ACESSO', 'Usuario', id);
  }

  /** LGPD: desativa e anonimiza, preservando o identificador interno na trilha de auditoria (sistema.md, B23). */
  @Post('admin/users/:id/anonymize')
  @HttpCode(204)
  @Roles(...R.ADMIN)
  async anonymize(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const m = await this.membership(auth, id);
    if (id === auth.userId) throw new ConflictException('Você não pode anonimizar a própria conta.');
    const others = await this.prisma.membership.count({ where: { userId: id, orgId: { not: auth.orgId } } });
    if (others > 0) throw new ConflictException('Usuário vinculado a outras organizações.');
    if (m.role === 'ADMIN') await this.ensureAnotherAdmin(auth, id);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { name: 'Usuário removido', email: null, passwordHash: null, active: false, username: `removido-${id.slice(0, 8)}` },
      }),
      this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log(auth, 'ANONIMIZAR', 'Usuario', id);
  }

  @Get('admin/organization')
  async org(@Auth() auth: AuthCtx) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id: auth.orgId } });
  }

  @Patch('admin/organization')
  @Roles(...R.ADMIN)
  async updateOrg(@Auth() auth: AuthCtx, @Body(new ZodPipe(orgSchema)) body: z.infer<typeof orgSchema>) {
    const org = await this.prisma.organization.update({ where: { id: auth.orgId }, data: body });
    await this.audit.log(auth, 'ALTERAR', 'Organizacao', auth.orgId, body);
    return org;
  }

  @Get('audit-logs')
  @Roles(...R.PMO)
  async auditLogs(@Auth() auth: AuthCtx, @Query('entity') entity?: string, @Query('action') action?: string, @Query('page') page = '1') {
    const p = Math.max(1, Number(page) || 1);
    const where = { orgId: auth.orgId, ...(entity ? { entity } : {}), ...(action ? { action } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (p - 1) * 50, take: 50 }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])] } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    await this.audit.log(auth, 'CONSULTAR', 'Auditoria', null, { entity, action, page: p });
    return { total, page: p, pageSize: 50, rows: rows.map((r) => ({ ...r, userName: r.userId ? names.get(r.userId) ?? null : null })) };
  }

  @Get('notifications')
  async notifications(@Auth() auth: AuthCtx) {
    const rows = await this.prisma.notification.findMany({
      where: { orgId: auth.orgId, userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { unread: rows.filter((r) => !r.readAt).length, rows };
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async read(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.notification.updateMany({ where: { id, orgId: auth.orgId, userId: auth.userId }, data: { readAt: new Date() } });
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  async readAll(@Auth() auth: AuthCtx) {
    await this.prisma.notification.updateMany({ where: { orgId: auth.orgId, userId: auth.userId, readAt: null }, data: { readAt: new Date() } });
  }
}
