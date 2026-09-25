import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, R, Roles } from '../common/auth-context';
import { crudController, z } from '../common/crud.factory';
import { assertRefs, findInOrg } from '../common/org-scope';
import { parseOrThrow, zDate, zDecimal, zId, zOptId, zOptText, zPosMoney, zText } from '../common/validation';
import { addDays, isoDate, toDateOnly, weekStart, workdaysBetween } from '../domain/dates';

const RESOURCE_TYPES = ['PESSOA', 'EQUIPAMENTO', 'MAQUINA', 'VEICULO', 'CONSULTOR'] as const;
const hours = zDecimal(4, 2).refine((s) => Number(s) >= 0 && Number(s) <= 168, 'Horas entre 0 e 168.');

export const ResourceController = crudController({
  path: 'resources',
  model: 'resource',
  entity: 'Recurso',
  tag: 'Gestão de Recursos',
  create: z.object({
    name: zText(150),
    type: z.enum(RESOURCE_TYPES),
    userId: zOptId,
    weeklyCapacityHours: hours.nullable().optional(),
    costPerHour: zPosMoney.nullable().optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    certifications: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
    active: z.boolean().optional(),
  }),
  refs: { userId: 'member' },
  filters: ['type', 'active'],
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
});

export const AllocationController = crudController({
  path: 'allocations',
  model: 'allocation',
  entity: 'Alocacao',
  tag: 'Gestão de Recursos',
  create: z.object({ resourceId: zId, projectId: zId, startDate: zDate, endDate: zDate, hoursPerWeek: hours }),
  refs: { resourceId: 'resource', projectId: 'project' },
  filters: ['resourceId', 'projectId'],
  orderBy: { startDate: 'asc' },
  beforeWrite(data, { existing }) {
    const s = data.startDate ?? existing?.startDate;
    const e = data.endDate ?? existing?.endDate;
    if (e < s) throw new BadRequestException('O período termina antes de começar.');
    return data;
  },
});

const entrySchema = z.object({
  projectId: zId,
  taskId: zOptId,
  date: zDate,
  hours: zDecimal(2, 2).refine((s) => Number(s) > 0 && Number(s) <= 24, 'Horas devem ser maiores que 0 e no máximo 24.'),
  description: zOptText(1000),
});

@ApiTags('Gestão de Recursos')
@Controller()
export class ResourcesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Capacidade × demanda por semana. Utilização = (alocado ou apontado aprovado) / capacidade semanal cadastrada.
   * Sem capacidade cadastrada, a utilização é indisponível (sistema.md, B17).
   */
  @Get('resources-capacity')
  async capacity(@Auth() auth: AuthCtx, @Query('from') fromQ?: string, @Query('weeks') weeksQ?: string) {
    const weeks = Math.min(26, Math.max(1, Number(weeksQ) || 8));
    const from = weekStart(fromQ ? zDate.parse(fromQ) : new Date());
    const until = addDays(from, weeks * 7 - 1);
    const [resources, allocations, entries] = await Promise.all([
      this.prisma.resource.findMany({ where: { orgId: auth.orgId, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.allocation.findMany({ where: { orgId: auth.orgId, startDate: { lte: until }, endDate: { gte: from } } }),
      this.prisma.timeEntry.findMany({ where: { orgId: auth.orgId, status: 'APROVADO', date: { gte: from, lte: until } } }),
    ]);
    const weekList = Array.from({ length: weeks }, (_, i) => addDays(from, i * 7));
    return {
      weeks: weekList.map(isoDate),
      rule: 'Alocação semanal proporcional aos dias úteis de sobreposição; horas apontadas aprovadas para recursos vinculados a usuários.',
      rows: resources.map((r) => {
        const cap = r.weeklyCapacityHours === null ? null : Number(r.weeklyCapacityHours);
        return {
          resource: { id: r.id, name: r.name, type: r.type },
          capacity: cap,
          cells: weekList.map((w) => {
            const wEnd = addDays(w, 6);
            let allocated = 0;
            for (const a of allocations.filter((x) => x.resourceId === r.id)) {
              const s = a.startDate > w ? a.startDate : w;
              const e = a.endDate < wEnd ? a.endDate : wEnd;
              const overlap = workdaysBetween(s, e);
              allocated += (Number(a.hoursPerWeek) * overlap) / 5;
            }
            const logged = r.userId
              ? entries.filter((t) => t.userId === r.userId && t.date >= w && t.date <= wEnd).reduce((s, t) => s + Number(t.hours), 0)
              : 0;
            const demand = Math.max(allocated, logged);
            return {
              week: isoDate(w),
              allocated: round(allocated),
              logged: round(logged),
              utilization: cap && cap > 0 ? round(demand / cap) : null,
            };
          }),
        };
      }),
    };
  }

  // ───── Timesheet ─────
  private isApprover(auth: AuthCtx) {
    return R.MANAGE.includes(auth.role);
  }

  private async assertUnlocked(orgId: string, date: Date) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (org.timesheetLockedUntil && toDateOnly(date) <= org.timesheetLockedUntil) {
      throw new ConflictException(`Período de apontamentos bloqueado até ${isoDate(org.timesheetLockedUntil)}.`);
    }
  }

  private async assertDailyLimit(orgId: string, userId: string, date: Date, hours: number, excludeId?: string) {
    const same = await this.prisma.timeEntry.findMany({ where: { orgId, userId, date: toDateOnly(date), ...(excludeId ? { id: { not: excludeId } } : {}) } });
    const total = same.reduce((s, e) => s + Number(e.hours), 0) + hours;
    if (total > 24) throw new BadRequestException('O total apontado no dia ultrapassa 24 horas.');
  }

  @Get('timesheet')
  async list(@Auth() auth: AuthCtx, @Query('from') from?: string, @Query('to') to?: string, @Query('userId') userId?: string, @Query('status') status?: string) {
    if (auth.role === 'LEITOR') throw new ForbiddenException('Leitores não acessam o timesheet.');
    const who = this.isApprover(auth) ? userId : auth.userId;
    const rows = await this.prisma.timeEntry.findMany({
      where: {
        orgId: auth.orgId,
        ...(who ? { userId: who } : {}),
        ...(status ? { status: status as any } : {}),
        date: { ...(from ? { gte: zDate.parse(from) } : {}), ...(to ? { lte: zDate.parse(to) } : {}) },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true } }),
      this.prisma.project.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.projectId))] } }, select: { id: true, name: true, code: true } }),
    ]);
    const un = new Map(users.map((u) => [u.id, u.name]));
    const pn = new Map(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: auth.orgId } });
    return {
      lockedUntil: org.timesheetLockedUntil ? isoDate(org.timesheetLockedUntil) : null,
      overtimePolicy: 'Banco de horas e horas extras pendentes da política de jornada da organização (sistema.md, B17).',
      rows: rows.map((r) => ({
        ...r,
        userName: un.get(r.userId) ?? null,
        projectName: pn.get(r.projectId) ?? null,
        canDecide: this.isApprover(auth) && r.userId !== auth.userId && r.status === 'SUBMETIDO',
      })),
    };
  }

  @Post('timesheet')
  @Roles(...R.WORKERS)
  async create(@Auth() auth: AuthCtx, @Body() body: unknown) {
    const data = parseOrThrow(entrySchema, body);
    await assertRefs(this.prisma, auth.orgId, data, { projectId: 'project', taskId: 'task' });
    await this.assertUnlocked(auth.orgId, data.date);
    await this.assertDailyLimit(auth.orgId, auth.userId, data.date, Number(data.hours));
    const e = await this.prisma.timeEntry.create({ data: { ...data, orgId: auth.orgId, userId: auth.userId } });
    await this.audit.log(auth, 'CRIAR', 'Apontamento', e.id, data);
    return e;
  }

  private async own(auth: AuthCtx, id: string) {
    const e = await findInOrg<any>(this.prisma, 'timeEntry', id, auth.orgId);
    if (e.userId !== auth.userId) throw new ForbiddenException('Você só altera os próprios apontamentos.');
    if (!['RASCUNHO', 'REJEITADO'].includes(e.status)) throw new ConflictException('Apontamento submetido ou aprovado não pode ser alterado.');
    await this.assertUnlocked(auth.orgId, e.date);
    return e;
  }

  @Patch('timesheet/:id')
  @Roles(...R.WORKERS)
  async update(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const data = parseOrThrow(entrySchema.partial(), body);
    const e = await this.own(auth, id);
    await assertRefs(this.prisma, auth.orgId, data, { projectId: 'project', taskId: 'task' });
    if (data.date) await this.assertUnlocked(auth.orgId, data.date);
    await this.assertDailyLimit(auth.orgId, auth.userId, data.date ?? e.date, Number(data.hours ?? e.hours), id);
    const updated = await this.prisma.timeEntry.update({ where: { id }, data: { ...data, status: 'RASCUNHO', rejectReason: null } });
    await this.audit.log(auth, 'ALTERAR', 'Apontamento', id, data);
    return updated;
  }

  @Delete('timesheet/:id')
  @HttpCode(204)
  @Roles(...R.WORKERS)
  async remove(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const e = await this.own(auth, id);
    await this.prisma.timeEntry.delete({ where: { id } });
    await this.audit.log(auth, 'EXCLUIR', 'Apontamento', id, e);
  }

  @Post('timesheet/submit')
  @HttpCode(200)
  @Roles(...R.WORKERS)
  async submit(@Auth() auth: AuthCtx, @Body() body: unknown) {
    const { ids } = parseOrThrow(z.object({ ids: z.array(zId).min(1).max(500) }), body);
    const r = await this.prisma.timeEntry.updateMany({
      where: { id: { in: ids }, orgId: auth.orgId, userId: auth.userId, status: { in: ['RASCUNHO', 'REJEITADO'] } },
      data: { status: 'SUBMETIDO' },
    });
    await this.audit.log(auth, 'SUBMETER', 'Apontamento', null, { ids, submetidos: r.count });
    return { submitted: r.count };
  }

  @Post('timesheet/:id/decide')
  @HttpCode(200)
  @Roles(...R.MANAGE)
  async decide(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { decision, reason } = parseOrThrow(
      z.object({ decision: z.enum(['APROVADO', 'REJEITADO']), reason: z.string().trim().max(500).optional() }),
      body,
    );
    const e = await findInOrg<any>(this.prisma, 'timeEntry', id, auth.orgId);
    if (e.userId === auth.userId) throw new ForbiddenException('Quem aponta não aprova o próprio apontamento.');
    if (e.status !== 'SUBMETIDO') throw new ConflictException('Somente apontamentos submetidos podem ser decididos.');
    if (decision === 'REJEITADO' && !reason) throw new BadRequestException('Informe o motivo da rejeição.');
    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: { status: decision, decidedById: auth.userId, decidedAt: new Date(), rejectReason: decision === 'REJEITADO' ? reason : null },
    });
    await this.prisma.notification.create({
      data: {
        orgId: auth.orgId,
        userId: e.userId,
        title: decision === 'APROVADO' ? 'Horas aprovadas' : 'Horas rejeitadas',
        body: `${isoDate(e.date)} — ${Number(e.hours)} h${reason ? ` — ${reason}` : ''}`,
        link: '/recursos/timesheet',
      },
    });
    await this.audit.log(auth, decision === 'APROVADO' ? 'APROVAR' : 'REJEITAR', 'Apontamento', id, { reason });
    return updated;
  }
}

const round = (v: number) => Math.round(v * 100) / 100;
