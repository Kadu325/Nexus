import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, R, Roles } from '../common/auth-context';
import { crudController, z } from '../common/crud.factory';
import { findInOrg } from '../common/org-scope';
import { parseOrThrow, zDate, zDateTime, zId, zOptDate, zOptId, zOptText, zText } from '../common/validation';

const CRIT = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
const LOCKED = ['EM_APROVACAO', 'APROVADO'];

// ─────────────── Governança de TI ───────────────

export const ItSystemController = crudController({
  path: 'it-systems',
  model: 'itSystem',
  entity: 'SistemaTI',
  tag: 'Governança de TI',
  create: z.object({
    name: zText(150),
    vendor: zOptText(150),
    ownerId: zOptId,
    criticality: z.enum(CRIT).optional(),
    lifecycle: z.enum(['EM_AVALIACAO', 'EM_PRODUCAO', 'EM_DESCONTINUACAO', 'DESCONTINUADO']).optional(),
    endOfSupport: zOptDate,
    notes: zOptText(),
  }),
  refs: { ownerId: 'member' },
  filters: ['criticality', 'lifecycle'],
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
  decorate: (r) => {
    const days = r.endOfSupport ? Math.ceil((new Date(r.endOfSupport).getTime() - Date.now()) / 86_400_000) : null;
    return {
      ...r,
      daysToEndOfSupport: days,
      supportAlert: days === null || r.lifecycle === 'DESCONTINUADO' ? null : days < 0 ? 'SUPORTE_ENCERRADO' : days <= 180 ? 'FIM_PROXIMO' : null,
    };
  },
});

export const ChangeRequestController = crudController({
  path: 'change-requests',
  model: 'changeRequest',
  entity: 'Mudanca',
  tag: 'Governança de TI',
  create: z.object({
    systemId: zOptId,
    projectId: zOptId,
    title: zText(200),
    justification: zOptText(),
    risk: z.enum(CRIT).optional(),
    plannedStart: zDateTime.nullable().optional(),
    plannedEnd: zDateTime.nullable().optional(),
    rollbackPlan: zOptText(),
  }),
  refs: { systemId: 'itSystem', projectId: 'project' },
  filters: ['systemId', 'projectId', 'status'],
  async beforeWrite(data, { auth, existing }) {
    if (existing && LOCKED.includes(existing.status)) throw new ConflictException('Mudança em aprovação ou aprovada é somente leitura.');
    if (existing?.status === 'REJEITADO') data.status = 'RASCUNHO';
    const s = data.plannedStart ?? existing?.plannedStart;
    const e = data.plannedEnd ?? existing?.plannedEnd;
    if (s && e && e < s) throw new BadRequestException('A janela termina antes de começar.');
    if (!existing) data.requestedById = auth.userId;
    return data;
  },
  async beforeDelete(existing) {
    if (existing.status !== 'RASCUNHO') throw new ConflictException('Somente rascunhos podem ser excluídos.');
  },
});

@ApiTags('Governança de TI')
@Controller()
export class GovernanceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post('change-requests/:id/implemented')
  @HttpCode(200)
  @Roles(...R.MANAGE)
  async implemented(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const c = await findInOrg<any>(this.prisma, 'changeRequest', id, auth.orgId);
    if (c.status !== 'APROVADO') throw new ConflictException('Somente mudanças aprovadas podem ser registradas como implementadas.');
    if (c.implementedAt) throw new ConflictException('Implementação já registrada.');
    const updated = await this.prisma.changeRequest.update({ where: { id }, data: { implementedAt: new Date() } });
    await this.audit.log(auth, 'IMPLEMENTAR', 'Mudanca', id);
    return updated;
  }

  // ─────────────── Compliance ───────────────

  @Get('compliance/summary')
  async summary(@Auth() auth: AuthCtx) {
    const [frameworks, controls, ncs] = await Promise.all([
      this.prisma.framework.findMany({ where: { orgId: auth.orgId }, orderBy: { name: 'asc' } }),
      this.prisma.control.findMany({ where: { orgId: auth.orgId }, select: { frameworkId: true, lastResult: true } }),
      this.prisma.nonConformity.groupBy({ by: ['status'], where: { orgId: auth.orgId }, _count: true }),
    ]);
    const perFramework = frameworks.map((f) => {
      const cs = controls.filter((c) => c.frameworkId === f.id);
      const assessed = cs.filter((c) => c.lastResult !== 'NAO_AVALIADO');
      const conform = assessed.filter((c) => c.lastResult === 'CONFORME').length;
      return {
        framework: { id: f.id, name: f.name, version: f.version },
        controls: cs.length,
        assessed: assessed.length,
        notAssessed: cs.length - assessed.length,
        conform,
        partial: assessed.filter((c) => c.lastResult === 'PARCIAL').length,
        nonConform: assessed.filter((c) => c.lastResult === 'NAO_CONFORME').length,
        conformity: assessed.length ? Math.round((conform / assessed.length) * 1000) / 1000 : null,
      };
    });
    return {
      rule: 'Conformidade = controles conformes / controles avaliados. Não avaliados ficam fora do denominador. Não representa certificação.',
      perFramework,
      nonConformities: Object.fromEntries(ncs.map((n) => [n.status, n._count])),
    };
  }

  @Get('controls/:id/detail')
  async controlDetail(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const control = await findInOrg<any>(this.prisma, 'control', id, auth.orgId, { include: { framework: true } });
    const [evidences, assessments, ncs] = await Promise.all([
      this.prisma.evidence.findMany({ where: { orgId: auth.orgId, controlId: id }, orderBy: { collectedAt: 'desc' } }),
      this.prisma.assessment.findMany({ where: { orgId: auth.orgId, controlId: id }, orderBy: { assessedAt: 'desc' } }),
      this.prisma.nonConformity.findMany({ where: { orgId: auth.orgId, controlId: id }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { control, evidences, assessments, nonConformities: ncs };
  }

  /** Evidência não é apagada; pode ser substituída por outra (sistema.md, Compliance Tecnológico). */
  @Post('controls/:id/evidences')
  @Roles(...R.MANAGE)
  async addEvidence(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) controlId: string, @Body() body: unknown) {
    const data = parseOrThrow(
      z.object({ description: zText(1000), reference: zOptText(1000), collectedAt: zDate, supersedesId: zOptId }),
      body,
    );
    await findInOrg(this.prisma, 'control', controlId, auth.orgId);
    return this.prisma.$transaction(async (tx) => {
      const ev = await tx.evidence.create({
        data: { orgId: auth.orgId, controlId, description: data.description, reference: data.reference ?? null, collectedAt: data.collectedAt, createdById: auth.userId },
      });
      if (data.supersedesId) {
        const old = await tx.evidence.findFirst({ where: { id: data.supersedesId, orgId: auth.orgId, controlId } });
        if (!old) throw new BadRequestException('Evidência substituída não encontrada neste controle.');
        await tx.evidence.update({ where: { id: old.id }, data: { supersededById: ev.id } });
      }
      await this.audit.log(auth, 'CRIAR', 'Evidencia', ev.id, data, tx);
      return ev;
    });
  }

  /** Avaliação: Não conforme gera não conformidade automaticamente com plano de ação a preencher. */
  @Post('controls/:id/assessments')
  @Roles(...R.PMO)
  async assess(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) controlId: string, @Body() body: unknown) {
    const data = parseOrThrow(
      z.object({ result: z.enum(['CONFORME', 'PARCIAL', 'NAO_CONFORME', 'NAO_AVALIADO']), notes: zOptText(2000) }),
      body,
    );
    const control = await findInOrg<any>(this.prisma, 'control', controlId, auth.orgId);
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.assessment.create({
        data: { orgId: auth.orgId, controlId, result: data.result, notes: data.notes ?? null, assessedById: auth.userId },
      });
      await tx.control.update({ where: { id: controlId }, data: { lastResult: data.result, lastAssessedAt: a.assessedAt } });
      let nc = null;
      if (data.result === 'NAO_CONFORME') {
        nc = await tx.nonConformity.create({
          data: {
            orgId: auth.orgId,
            controlId,
            source: 'COMPLIANCE',
            title: `Controle ${control.code} não conforme`,
            description: data.notes ?? null,
            ownerId: control.ownerId,
          },
        });
      }
      await this.audit.log(auth, 'AVALIAR', 'Controle', controlId, { ...data, naoConformidade: nc?.id }, tx);
      return { assessment: a, nonConformity: nc };
    });
  }

  @Get('evidences')
  async evidences(@Auth() auth: AuthCtx, @Query('controlId') controlId?: string) {
    return this.prisma.evidence.findMany({ where: { orgId: auth.orgId, ...(controlId ? { controlId } : {}) }, orderBy: { collectedAt: 'desc' }, take: 500 });
  }

  @Post('non-conformities/:id/close')
  @HttpCode(200)
  @Roles(...R.PMO)
  async closeNc(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const nc = await findInOrg<any>(this.prisma, 'nonConformity', id, auth.orgId);
    if (nc.status === 'ENCERRADA') throw new ConflictException('Não conformidade já encerrada.');
    if (!nc.actionPlan?.trim()) throw new BadRequestException('Registre o plano de ação antes de encerrar.');
    const updated = await this.prisma.nonConformity.update({ where: { id }, data: { status: 'ENCERRADA', closedAt: new Date() } });
    await this.audit.log(auth, 'ENCERRAR', 'NaoConformidade', id);
    return updated;
  }
}

export const FrameworkController = crudController({
  path: 'frameworks',
  model: 'framework',
  entity: 'Framework',
  tag: 'Compliance Tecnológico',
  create: z.object({ name: zText(100), version: zOptText(50) }),
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
  include: { _count: { select: { controls: true } } },
});

export const ControlController = crudController({
  path: 'controls',
  model: 'control',
  entity: 'Controle',
  tag: 'Compliance Tecnológico',
  create: z.object({
    frameworkId: zId,
    code: zText(30),
    title: zText(300),
    description: zOptText(),
    requirementRef: zOptText(200),
    ownerId: zOptId,
    frequency: z.enum(['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL']).optional(),
  }),
  refs: { frameworkId: 'framework', ownerId: 'member' },
  filters: ['frameworkId', 'lastResult'],
  writeRoles: R.PMO,
  orderBy: [{ code: 'asc' }],
  include: { framework: { select: { id: true, name: true } } },
  deletable: false,
});

export const NonConformityController = crudController({
  path: 'non-conformities',
  model: 'nonConformity',
  entity: 'NaoConformidade',
  tag: 'Compliance Tecnológico',
  create: z.object({
    controlId: zOptId,
    projectId: zOptId,
    source: z.enum(['COMPLIANCE', 'QUALIDADE', 'AUDITORIA']).optional(),
    title: zText(200),
    description: zOptText(),
    actionPlan: zOptText(),
    ownerId: zOptId,
    dueDate: zOptDate,
    status: z.enum(['ABERTA', 'EM_TRATAMENTO']).optional(),
  }),
  refs: { controlId: 'control', projectId: 'project', ownerId: 'member' },
  filters: ['status', 'source', 'projectId', 'controlId'],
  deletable: false,
  beforeWrite(data, { existing }) {
    if (existing?.status === 'ENCERRADA') throw new ConflictException('Não conformidade encerrada é somente leitura.');
    return data;
  },
});

