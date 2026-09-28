import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApprovalEntity, ApprovalState, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, R, Roles } from '../common/auth-context';
import { parseOrThrow, zId } from '../common/validation';

type Tx = Prisma.TransactionClient;

interface Target {
  status: ApprovalState;
  title: string;
  missing: string[];
}

/** Campos obrigatórios do TAP (sistema.md, Prioridade 2). O nome vem do projeto. */
export const CHARTER_REQUIRED: [string, string][] = [
  ['objectives', 'Objetivos'],
  ['scope', 'Escopo'],
  ['assumptions', 'Premissas'],
  ['constraints', 'Restrições'],
  ['sponsor', 'Patrocinador'],
  ['stakeholdersText', 'Stakeholders'],
  ['budget', 'Orçamento'],
  ['macroSchedule', 'Cronograma Macro'],
];

export function charterMissing(c: Record<string, unknown> | null): string[] {
  if (!c) return CHARTER_REQUIRED.map(([, l]) => l);
  return CHARTER_REQUIRED.filter(([k]) => c[k] === null || c[k] === undefined || String(c[k]).trim() === '').map(([, l]) => l);
}

@Injectable()
export class ApprovalsService {
  constructor(private readonly audit: AuditService) {}

  async load(tx: Tx, orgId: string, type: ApprovalEntity, id: string): Promise<Target> {
    switch (type) {
      case 'TAP': {
        const c = await tx.charter.findFirst({ where: { id, orgId } });
        if (!c) break;
        const p = await tx.project.findUnique({ where: { id: c.projectId } });
        return { status: c.status, title: `TAP — ${p?.name} (v${c.version})`, missing: charterMissing(c) };
      }
      case 'BUSINESS_CASE': {
        const b = await tx.businessCase.findFirst({ where: { id, orgId }, include: { lines: true } });
        if (!b) break;
        const p = await tx.project.findUnique({ where: { id: b.projectId } });
        const missing: string[] = [];
        if (!b.justification?.trim()) missing.push('Justificativa');
        if (b.lines.length === 0) missing.push('Benefícios e custos');
        return { status: b.status, title: `Business Case — ${p?.name}`, missing };
      }
      case 'DOCUMENTO': {
        const v = await tx.documentVersion.findFirst({ where: { id, orgId }, include: { document: true } });
        if (!v) break;
        return { status: v.status, title: `${v.document.title} (v${v.version})`, missing: v.content.trim() ? [] : ['Conteúdo'] };
      }
      case 'MUDANCA': {
        const c = await tx.changeRequest.findFirst({ where: { id, orgId } });
        if (!c) break;
        const missing: string[] = [];
        if (!c.justification?.trim()) missing.push('Justificativa');
        if ((c.risk === 'ALTA' || c.risk === 'CRITICA') && !c.rollbackPlan?.trim()) missing.push('Plano de reversão (obrigatório para risco alto ou crítico)');
        return { status: c.status, title: `Mudança — ${c.title}`, missing };
      }
    }
    throw new NotFoundException('Registro a aprovar não encontrado.');
  }

  async setStatus(tx: Tx, type: ApprovalEntity, id: string, status: ApprovalState, auth: AuthCtx) {
    const now = new Date();
    switch (type) {
      case 'TAP':
        return tx.charter.update({ where: { id }, data: { status } });
      case 'BUSINESS_CASE':
        return tx.businessCase.update({ where: { id }, data: { status } });
      case 'DOCUMENTO':
        return tx.documentVersion.update({
          where: { id },
          data: status === 'APROVADO' ? { status, approvedById: auth.userId, approvedAt: now } : { status },
        });
      case 'MUDANCA':
        return tx.changeRequest.update({ where: { id }, data: { status } });
    }
  }

  async submit(tx: Tx, auth: AuthCtx, type: ApprovalEntity, entityId: string) {
    const target = await this.load(tx, auth.orgId, type, entityId);
    if (target.status !== 'RASCUNHO' && target.status !== 'REJEITADO') {
      throw new ConflictException('Somente rascunhos ou itens rejeitados podem ser submetidos.');
    }
    if (target.missing.length) {
      throw new BadRequestException({ message: `Preencha antes de submeter: ${target.missing.join(', ')}.`, missing: target.missing });
    }
    const pending = await tx.approvalRequest.count({ where: { orgId: auth.orgId, entityType: type, entityId, status: 'PENDENTE' } });
    if (pending) throw new ConflictException('Já existe um pedido de aprovação pendente para este item.');
    await this.setStatus(tx, type, entityId, 'EM_APROVACAO', auth);
    const req = await tx.approvalRequest.create({
      data: { orgId: auth.orgId, entityType: type, entityId, title: target.title, requestedById: auth.userId },
    });
    const approvers = await tx.membership.findMany({ where: { orgId: auth.orgId, role: { in: R.PMO }, userId: { not: auth.userId } } });
    if (approvers.length) {
      await tx.notification.createMany({
        data: approvers.map((a) => ({
          orgId: auth.orgId,
          userId: a.userId,
          title: 'Aprovação pendente',
          body: target.title,
          link: '/pmo/aprovacoes',
        })),
      });
    }
    await this.audit.log(auth, 'SUBMETER', 'Aprovacao', req.id, { type, entityId }, tx);
    return req;
  }
}

const submitSchema = z.object({ entityType: z.enum(['TAP', 'BUSINESS_CASE', 'DOCUMENTO', 'MUDANCA']), entityId: zId });
const decideSchema = z.object({ decision: z.enum(['APROVADO', 'REJEITADO']), comment: z.string().trim().max(2000).optional() });

@ApiTags('PMO Corporativo')
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: ApprovalsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Auth() auth: AuthCtx, @Query('status') status?: string) {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { orgId: auth.orgId, ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const ids = [...new Set(rows.flatMap((r) => [r.requestedById, r.decidedById]).filter(Boolean) as string[])];
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      ...r,
      requestedByName: names.get(r.requestedById) ?? null,
      decidedByName: r.decidedById ? names.get(r.decidedById) ?? null : null,
      canDecide: r.status === 'PENDENTE' && R.PMO.includes(auth.role) && r.requestedById !== auth.userId,
    }));
  }

  @Post()
  @Roles(...R.MANAGE)
  async submit(@Auth() auth: AuthCtx, @Body() body: unknown) {
    const { entityType, entityId } = parseOrThrow(submitSchema, body);
    return this.prisma.$transaction((tx) => this.service.submit(tx, auth, entityType, entityId));
  }

  @Post(':id/decide')
  @HttpCode(200)
  @Roles(...R.PMO)
  async decide(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { decision, comment } = parseOrThrow(decideSchema, body);
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.approvalRequest.findFirst({ where: { id, orgId: auth.orgId } });
      if (!req) throw new NotFoundException('Pedido não encontrado.');
      if (req.status !== 'PENDENTE') throw new ConflictException('Este pedido já foi decidido.');
      if (req.requestedById === auth.userId) throw new ForbiddenException('Quem submete não aprova o próprio pedido.');
      if (decision === 'REJEITADO' && !comment) throw new BadRequestException('Informe o motivo da rejeição.');
      const updated = await tx.approvalRequest.updateMany({
        where: { id, status: 'PENDENTE' },
        data: { status: decision, decidedById: auth.userId, decidedAt: new Date(), comment: comment ?? null },
      });
      if (updated.count === 0) throw new ConflictException('Este pedido já foi decidido.');
      await this.service.setStatus(tx, req.entityType, req.entityId, decision, auth);
      await tx.notification.create({
        data: {
          orgId: auth.orgId,
          userId: req.requestedById,
          title: decision === 'APROVADO' ? 'Pedido aprovado' : 'Pedido rejeitado',
          body: `${req.title}${comment ? ` — ${comment}` : ''}`,
          link: '/pmo/aprovacoes',
        },
      });
      await this.audit.log(auth, decision === 'APROVADO' ? 'APROVAR' : 'REJEITAR', 'Aprovacao', id, { type: req.entityType, entityId: req.entityId, comment }, tx);
      return tx.approvalRequest.findUnique({ where: { id } });
    });
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(...R.MANAGE)
  async cancel(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.approvalRequest.findFirst({ where: { id, orgId: auth.orgId } });
      if (!req) throw new NotFoundException('Pedido não encontrado.');
      if (req.status !== 'PENDENTE') throw new ConflictException('Somente pedidos pendentes podem ser cancelados.');
      if (req.requestedById !== auth.userId && auth.role !== 'ADMIN') throw new ForbiddenException('Somente quem submeteu pode cancelar.');
      await tx.approvalRequest.update({ where: { id }, data: { status: 'CANCELADO', decidedById: auth.userId, decidedAt: new Date() } });
      await this.service.setStatus(tx, req.entityType, req.entityId, 'RASCUNHO', auth);
      await this.audit.log(auth, 'CANCELAR', 'Aprovacao', id, {}, tx);
      return { ok: true };
    });
  }
}
