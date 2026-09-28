import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApprovalState } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, R, Roles } from '../common/auth-context';
import { crudController, z } from '../common/crud.factory';
import { findInOrg } from '../common/org-scope';
import { parseOrThrow, zDate, zOptId, zOptText, zPosMoney, zScale5, zText } from '../common/validation';
import { computeBusinessCase } from '../domain/business-case';
import { toCents } from '../domain/money';
import { riskBand, riskExposure, stakeholderQuadrant } from '../domain/risk';
import { charterMissing } from './approvals';

const EDITABLE: ApprovalState[] = ['RASCUNHO', 'REJEITADO'];

const charterSchema = z.object({
  objectives: zOptText(),
  scope: zOptText(),
  assumptions: zOptText(),
  constraints: zOptText(),
  sponsor: zOptText(200),
  stakeholdersText: zOptText(),
  budget: zPosMoney.nullable().optional(),
  macroSchedule: zOptText(),
});

const caseSchema = z.object({
  justification: zOptText(),
  feasibility: zOptText(),
  benefitsText: zOptText(),
});

const lineSchema = z.object({
  period: z.coerce.number().int().min(1).max(600),
  kind: z.enum(['BENEFICIO', 'CUSTO']),
  category: zOptText(100),
  description: zText(300),
  amount: zPosMoney,
});

@ApiTags('PMO Corporativo')
@Controller('projects/:projectId')
export class PmoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ───── TAP ─────
  @Get('charter')
  async charter(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const project = await findInOrg<any>(this.prisma, 'project', projectId, auth.orgId);
    const charter = await this.prisma.charter.findFirst({ where: { orgId: auth.orgId, projectId } });
    return { project: { id: project.id, name: project.name, code: project.code }, charter, missing: charterMissing(charter) };
  }

  @Put('charter')
  @Roles(...R.MANAGE)
  async saveCharter(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() body: unknown) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const data = parseOrThrow(charterSchema, body);
    const existing = await this.prisma.charter.findFirst({ where: { orgId: auth.orgId, projectId } });
    if (existing && !EDITABLE.includes(existing.status)) {
      throw new ConflictException('TAP em aprovação ou aprovado é somente leitura. Abra uma nova versão para alterar.');
    }
    const charter = existing
      ? await this.prisma.charter.update({ where: { id: existing.id }, data: { ...data, status: 'RASCUNHO' } })
      : await this.prisma.charter.create({ data: { ...data, orgId: auth.orgId, projectId } });
    await this.audit.log(auth, existing ? 'ALTERAR' : 'CRIAR', 'TAP', charter.id, data);
    return { charter, missing: charterMissing(charter) };
  }

  @Post('charter/new-version')
  @Roles(...R.MANAGE)
  async charterNewVersion(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const c = await this.prisma.charter.findFirst({ where: { orgId: auth.orgId, projectId } });
    if (!c || c.status !== 'APROVADO') throw new ConflictException('Somente um TAP aprovado pode gerar nova versão.');
    // a versão aprovada fica preservada integralmente na trilha de auditoria
    await this.audit.log(auth, 'VERSAO_APROVADA_PRESERVADA', 'TAP', c.id, c);
    return this.prisma.charter.update({ where: { id: c.id }, data: { status: 'RASCUNHO', version: { increment: 1 } } });
  }

  // ───── Business Case ─────
  @Get('business-case')
  async businessCase(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const bc = await this.prisma.businessCase.findFirst({
      where: { orgId: auth.orgId, projectId },
      include: { lines: { orderBy: [{ period: 'asc' }, { kind: 'asc' }] } },
    });
    const result = computeBusinessCase(
      (bc?.lines ?? []).map((l) => ({ period: l.period, kind: l.kind, amountCents: toCents(l.amount) })),
    );
    return {
      businessCase: bc,
      result,
      formulas: {
        tco: 'Soma dos custos no horizonte',
        roi: '(Benefícios − Custos) / Custos',
        payback: 'Primeiro mês com fluxo líquido acumulado ≥ 0',
        observacao: 'Valores sem desconto (VPL pendente de política financeira).',
      },
    };
  }

  private async editableCase(auth: AuthCtx, projectId: string) {
    const bc = await this.prisma.businessCase.findFirst({ where: { orgId: auth.orgId, projectId } });
    if (bc && !EDITABLE.includes(bc.status)) throw new ConflictException('Business Case em aprovação ou aprovado é somente leitura.');
    return bc;
  }

  @Put('business-case')
  @Roles(...R.MANAGE)
  async saveCase(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() body: unknown) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const data = parseOrThrow(caseSchema, body);
    const existing = await this.editableCase(auth, projectId);
    const bc = existing
      ? await this.prisma.businessCase.update({ where: { id: existing.id }, data: { ...data, status: 'RASCUNHO' } })
      : await this.prisma.businessCase.create({ data: { ...data, orgId: auth.orgId, projectId } });
    await this.audit.log(auth, existing ? 'ALTERAR' : 'CRIAR', 'BusinessCase', bc.id, data);
    return bc;
  }

  @Post('business-case/lines')
  @Roles(...R.MANAGE)
  async addLine(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string, @Body() body: unknown) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const data = parseOrThrow(lineSchema, body);
    let bc = await this.editableCase(auth, projectId);
    bc ??= await this.prisma.businessCase.create({ data: { orgId: auth.orgId, projectId } });
    const line = await this.prisma.businessCaseLine.create({ data: { ...data, orgId: auth.orgId, businessCaseId: bc.id } });
    await this.audit.log(auth, 'CRIAR', 'BusinessCaseLinha', line.id, data);
    return line;
  }

  @Delete('business-case/lines/:lineId')
  @HttpCode(204)
  @Roles(...R.MANAGE)
  async removeLine(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string, @Param('lineId', ParseUUIDPipe) lineId: string) {
    const bc = await this.editableCase(auth, projectId);
    const line = await this.prisma.businessCaseLine.findFirst({ where: { id: lineId, orgId: auth.orgId, businessCaseId: bc?.id } });
    if (!line) throw new BadRequestException('Lançamento não encontrado.');
    await this.prisma.businessCaseLine.delete({ where: { id: lineId } });
    await this.audit.log(auth, 'EXCLUIR', 'BusinessCaseLinha', lineId, line);
  }

  @Post('business-case/new-version')
  @Roles(...R.MANAGE)
  async caseNewVersion(@Auth() auth: AuthCtx, @Param('projectId', ParseUUIDPipe) projectId: string) {
    const bc = await this.prisma.businessCase.findFirst({ where: { orgId: auth.orgId, projectId }, include: { lines: true } });
    if (!bc || bc.status !== 'APROVADO') throw new ConflictException('Somente um Business Case aprovado pode ser reaberto.');
    await this.audit.log(auth, 'VERSAO_APROVADA_PRESERVADA', 'BusinessCase', bc.id, bc);
    return this.prisma.businessCase.update({ where: { id: bc.id }, data: { status: 'RASCUNHO' } });
  }
}

// ───── Registros simples do PMO ─────

export const StakeholderController = crudController({
  path: 'stakeholders',
  model: 'stakeholder',
  entity: 'Stakeholder',
  tag: 'PMO Corporativo',
  create: z.object({
    projectId: z.string().uuid(),
    name: zText(150),
    organization: zOptText(150),
    role: zOptText(150),
    contact: zOptText(200),
    power: zScale5,
    interest: zScale5,
    attitude: zOptText(100),
    strategy: zOptText(2000),
    userId: zOptId,
  }),
  refs: { projectId: 'project', userId: 'member' },
  filters: ['projectId'],
  orderBy: { name: 'asc' },
  decorate: (r) => ({ ...r, quadrant: stakeholderQuadrant(r.power, r.interest) }),
});

export const RiskController = crudController({
  path: 'risks',
  model: 'risk',
  entity: 'Risco',
  tag: 'PMO Corporativo',
  create: z.object({
    projectId: z.string().uuid(),
    title: zText(200),
    description: zOptText(),
    category: zOptText(100),
    probability: zScale5,
    impact: zScale5,
    response: zOptText(),
    ownerId: zOptId,
    status: z.enum(['ABERTO', 'MITIGANDO', 'OCORRIDO', 'FECHADO']).optional(),
    contingency: zPosMoney.nullable().optional(),
  }),
  refs: { projectId: 'project', ownerId: 'member' },
  filters: ['projectId', 'status'],
  decorate: (r) => {
    const exposure = riskExposure(r.probability, r.impact);
    return { ...r, exposure, band: riskBand(exposure) };
  },
});

export const ContractController = crudController({
  path: 'contracts',
  model: 'contract',
  entity: 'Contrato',
  tag: 'PMO Corporativo',
  create: z.object({
    projectId: zOptId,
    costCenterId: zOptId,
    supplier: zText(200),
    object: zText(500),
    totalValue: zPosMoney,
    startDate: zDate,
    endDate: zDate,
    status: z.enum(['EM_NEGOCIACAO', 'VIGENTE', 'ENCERRADO', 'CANCELADO']).optional(),
    ownerId: zOptId,
  }),
  refs: { projectId: 'project', costCenterId: 'costCenter', ownerId: 'member' },
  filters: ['projectId', 'status'],
  writeRoles: R.PMO,
  orderBy: { endDate: 'asc' },
  beforeWrite(data, { existing }) {
    const s = data.startDate ?? existing?.startDate;
    const e = data.endDate ?? existing?.endDate;
    if (s && e && e < s) throw new BadRequestException('A vigência termina antes de começar.');
    return data;
  },
  decorate: (r) => {
    const days = Math.ceil((new Date(r.endDate).getTime() - Date.now()) / 86_400_000);
    return { ...r, daysToEnd: days, expiringSoon: r.status === 'VIGENTE' && days >= 0 && days <= 30 };
  },
});
