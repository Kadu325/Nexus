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
import { parseOrThrow, zDateTime, zId, zOptDate, zOptId, zOptText, zText } from '../common/validation';
import { extractActions, fingerprint } from '../domain/action-extractor';
import { toDateOnly } from '../domain/dates';

const MEETING_TYPES = ['REUNIAO', 'COMITE', 'KICKOFF', 'STATUS_REPORT', 'ENCERRAMENTO'] as const;

export const MeetingCrudController = crudController({
  path: 'meetings',
  model: 'meeting',
  entity: 'Reuniao',
  tag: 'PMO Corporativo — Sala de Reuniões',
  create: z.object({
    projectId: zId,
    title: zText(200),
    type: z.enum(MEETING_TYPES).optional(),
    scheduledAt: zDateTime,
    location: zOptText(300),
    notes: zOptText(50000),
  }),
  refs: { projectId: 'project' },
  filters: ['projectId', 'type'],
  orderBy: { scheduledAt: 'desc' },
  deleteRoles: R.PMO,
  async beforeWrite(data, { auth, existing }) {
    if (!existing) data.createdById = auth.userId;
    return data;
  },
  async beforeDelete(existing, { prisma }) {
    const converted = await prisma.meetingAction.count({ where: { meetingId: existing.id, taskId: { not: null } } });
    const docs = await prisma.document.count({ where: { meetingId: existing.id } });
    if (converted || docs) throw new ConflictException('Reunião com ata ou tarefas geradas não pode ser excluída.');
  },
});

const actionEdit = z.object({
  description: zText(500).optional(),
  assigneeId: zOptId,
  dueDate: zOptDate,
});

@ApiTags('PMO Corporativo — Sala de Reuniões')
@Controller()
export class MeetingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async names(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter(Boolean) as string[])];
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  /** Sala de Reuniões: reunião, decisões, ações (status atual) e ata versionada (conteúdo histórico). */
  @Get('meetings/:id/room')
  async room(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const meeting = await findInOrg<any>(this.prisma, 'meeting', id, auth.orgId, {
      include: { decisions: { orderBy: { createdAt: 'asc' } }, actions: { orderBy: { createdAt: 'asc' } } },
    });
    const project = await this.prisma.project.findUnique({
      where: { id: meeting.projectId },
      select: { id: true, name: true, code: true, autoCreateTasksFromActions: true },
    });
    const ata = await this.prisma.document.findFirst({
      where: { orgId: auth.orgId, meetingId: id, type: 'ATA' },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    const names = await this.names([
      ...meeting.actions.flatMap((a: any) => [a.assigneeId, a.completedById, ...a.candidateIds]),
      ...(ata?.versions.map((v) => v.approvedById) ?? []),
    ]);
    const approvedAta = ata?.versions.find((v) => v.status === 'APROVADO') ?? null;
    return {
      meeting: { ...meeting, actions: undefined, decisions: undefined },
      project,
      decisions: meeting.decisions,
      actions: meeting.actions.map((a: any) => ({
        ...a,
        assigneeName: a.assigneeId ? names.get(a.assigneeId) ?? null : null,
        completedByName: a.completedById ? names.get(a.completedById) ?? null : null,
        candidates: a.candidateIds.map((cid: string) => ({ id: cid, name: names.get(cid) ?? '—' })),
      })),
      ata: ata
        ? {
            id: ata.id,
            title: ata.title,
            versions: ata.versions.map((v) => ({ ...v, approvedByName: v.approvedById ? names.get(v.approvedById) ?? null : null })),
          }
        : null,
      conversionPolicy: {
        ataApproved: !!approvedAta,
        autoPolicy: project?.autoCreateTasksFromActions ?? false,
        allowed: !!approvedAta || !!project?.autoCreateTasksFromActions,
        rule: 'Ações validadas viram tarefas quando a ata está aprovada ou quando a política do projeto autoriza explicitamente.',
      },
    };
  }

  @Post('meetings/:id/decisions')
  @Roles(...R.MANAGE)
  async addDecision(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) meetingId: string, @Body() body: unknown) {
    const { description } = parseOrThrow(z.object({ description: zText(2000) }), body);
    await findInOrg(this.prisma, 'meeting', meetingId, auth.orgId);
    const d = await this.prisma.meetingDecision.create({ data: { orgId: auth.orgId, meetingId, description } });
    await this.audit.log(auth, 'CRIAR', 'Decisao', d.id, { meetingId, description });
    return d;
  }

  @Delete('decisions/:id')
  @HttpCode(204)
  @Roles(...R.MANAGE)
  async removeDecision(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const d = await this.prisma.meetingDecision.findFirst({ where: { id, orgId: auth.orgId } });
    if (!d) throw new BadRequestException('Decisão não encontrada.');
    await this.prisma.meetingDecision.delete({ where: { id } });
    await this.audit.log(auth, 'EXCLUIR', 'Decisao', id, d);
  }

  /** Extração determinística; reprocessar não duplica ações (impressão digital única por reunião). */
  @Post('meetings/:id/extract-actions')
  @Roles(...R.MANAGE)
  async extract(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) meetingId: string) {
    const meeting = await findInOrg<any>(this.prisma, 'meeting', meetingId, auth.orgId);
    if (!meeting.notes?.trim()) throw new BadRequestException('A reunião não possui anotações para analisar.');
    const members = await this.prisma.membership.findMany({ where: { orgId: auth.orgId, user: { active: true } }, include: { user: true } });
    const people = members.map((m) => ({ id: m.user.id, name: m.user.name }));
    const found = extractActions(meetingId, meeting.notes, people, new Date());
    const result = await this.prisma.meetingAction.createMany({
      data: found.map((a) => ({
        orgId: auth.orgId,
        meetingId,
        fingerprint: a.fingerprint,
        description: a.description,
        rawText: a.rawText,
        candidateIds: a.candidateIds,
        dueDateRaw: a.dueDateRaw,
        suggestedDueDate: a.suggestedDueDate ? new Date(`${a.suggestedDueDate}T00:00:00Z`) : null,
        issues: a.issues,
        status: 'EM_REVISAO' as const,
      })),
      skipDuplicates: true,
    });
    await this.audit.log(auth, 'EXTRAIR_ACOES', 'Reuniao', meetingId, { encontradas: found.length, novas: result.count });
    return { found: found.length, created: result.count, skippedAsDuplicate: found.length - result.count };
  }

  @Post('meetings/:id/actions')
  @Roles(...R.MANAGE)
  async addAction(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) meetingId: string, @Body() body: unknown) {
    const data = parseOrThrow(actionEdit.extend({ description: zText(500) }), body);
    await findInOrg(this.prisma, 'meeting', meetingId, auth.orgId);
    await assertRefs(this.prisma, auth.orgId, data, { assigneeId: 'member' });
    const a = await this.prisma.meetingAction.create({
      data: {
        orgId: auth.orgId,
        meetingId,
        fingerprint: fingerprint(meetingId, `manual:${data.description}:${Date.now()}`),
        description: data.description,
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate ?? null,
        status: 'EM_REVISAO',
      },
    });
    await this.audit.log(auth, 'CRIAR', 'AcaoReuniao', a.id, data);
    return a;
  }

  private async action(auth: AuthCtx, id: string) {
    const a = await this.prisma.meetingAction.findFirst({ where: { id, orgId: auth.orgId }, include: { meeting: true } });
    if (!a) throw new BadRequestException('Ação não encontrada.');
    return a;
  }

  @Patch('actions/:id')
  @Roles(...R.MANAGE)
  async editAction(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const data = parseOrThrow(actionEdit, body);
    const a = await this.action(auth, id);
    if (!['EM_REVISAO', 'VALIDADA'].includes(a.status)) throw new ConflictException('Ação já convertida: altere a tarefa vinculada.');
    await assertRefs(this.prisma, auth.orgId, data, { assigneeId: 'member' });
    const updated = await this.prisma.meetingAction.update({ where: { id }, data: { ...data, status: 'EM_REVISAO' } });
    await this.audit.log(auth, 'ALTERAR', 'AcaoReuniao', id, data);
    return updated;
  }

  /** Validação humana: responsável identificado por ID e prazo completo confirmado. */
  @Post('actions/:id/validate')
  @HttpCode(200)
  @Roles(...R.MANAGE)
  async validate(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const a = await this.action(auth, id);
    if (a.status !== 'EM_REVISAO') throw new ConflictException('Somente ações em revisão podem ser validadas.');
    const missing: string[] = [];
    if (!a.assigneeId) missing.push('responsável (selecione a pessoa)');
    if (!a.dueDate) missing.push('prazo com dia, mês e ano');
    if (missing.length) throw new BadRequestException(`Para validar, informe: ${missing.join(' e ')}.`);
    const updated = await this.prisma.meetingAction.update({ where: { id }, data: { status: 'VALIDADA', issues: [] } });
    await this.audit.log(auth, 'VALIDAR', 'AcaoReuniao', id, { assigneeId: a.assigneeId, dueDate: a.dueDate });
    return updated;
  }

  @Post('actions/:id/discard')
  @HttpCode(200)
  @Roles(...R.MANAGE)
  async discard(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const a = await this.action(auth, id);
    if (a.taskId) throw new ConflictException('Ação já convertida em tarefa.');
    const updated = await this.prisma.meetingAction.update({ where: { id }, data: { status: 'DESCARTADA' } });
    await this.audit.log(auth, 'DESCARTAR', 'AcaoReuniao', id);
    return updated;
  }

  /**
   * Converte ação validada em tarefa única (idempotente): a tarefa guarda sourceActionId único,
   * aparece no Kanban, em Meu Trabalho e no Gantt (quando agendada), com notificação ao responsável.
   */
  @Post('actions/:id/convert')
  @HttpCode(200)
  @Roles(...R.MANAGE)
  async convert(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const a = await this.action(auth, id);
    const existingTask = await this.prisma.task.findUnique({ where: { sourceActionId: id } });
    if (existingTask) return { task: existingTask, created: false, message: 'Ação já convertida anteriormente.' };
    if (a.status !== 'VALIDADA') throw new ConflictException('Valide a ação (responsável e prazo) antes de convertê-la.');

    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: a.meeting.projectId } });
    const approvedAta = await this.prisma.documentVersion.count({
      where: { orgId: auth.orgId, status: 'APROVADO', document: { meetingId: a.meetingId, type: 'ATA' } },
    });
    if (!approvedAta && !project.autoCreateTasksFromActions) {
      throw new ForbiddenException('A ata precisa estar aprovada, ou a política do projeto deve autorizar a criação automática de tarefas.');
    }

    return this.prisma.$transaction(async (tx) => {
      const due = toDateOnly(a.dueDate!);
      const task = await tx.task.upsert({
        where: { sourceActionId: id },
        update: {},
        create: {
          orgId: auth.orgId,
          projectId: project.id,
          title: a.description,
          description: `Origem: reunião "${a.meeting.title}"${a.rawText ? `\nTexto original: ${a.rawText}` : ''}`,
          assigneeId: a.assigneeId,
          endDate: due,
          // sem data de início informada, a tarefa fica como não agendada no Gantt (não inventamos datas)
          startDate: null,
          sourceActionId: id,
          createdById: auth.userId,
          tags: ['ata'],
        },
      });
      await tx.meetingAction.update({ where: { id }, data: { status: 'CONVERTIDA', taskId: task.id } });
      if (a.assigneeId) {
        await tx.notification.create({
          data: {
            orgId: auth.orgId,
            userId: a.assigneeId,
            title: 'Nova tarefa originada de reunião',
            body: task.title,
            link: `/projetos/${project.id}?tarefa=${task.id}`,
          },
        });
      }
      await this.audit.log(
        auth,
        'CONVERTER_ACAO',
        'AcaoReuniao',
        id,
        { taskId: task.id, meetingId: a.meetingId, politica: approvedAta ? 'ata aprovada' : 'automação autorizada no projeto' },
        tx,
      );
      return { task, created: true };
    });
  }

  // ───── Ata ─────
  @Post('meetings/:id/ata')
  @Roles(...R.MANAGE)
  async saveAta(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) meetingId: string, @Body() body: unknown) {
    const { content, aiGenerated } = parseOrThrow(z.object({ content: zText(100000), aiGenerated: z.boolean().optional() }), body);
    const meeting = await findInOrg<any>(this.prisma, 'meeting', meetingId, auth.orgId);
    return this.prisma.$transaction(async (tx) => {
      let doc = await tx.document.findFirst({ where: { orgId: auth.orgId, meetingId, type: 'ATA' }, include: { versions: true } });
      doc ??= await tx.document.create({
        data: { orgId: auth.orgId, projectId: meeting.projectId, meetingId, type: 'ATA', title: `Ata — ${meeting.title}` },
        include: { versions: true },
      });
      const draft = doc.versions.find((v) => v.status === 'RASCUNHO' || v.status === 'REJEITADO');
      const pending = doc.versions.find((v) => v.status === 'EM_APROVACAO');
      if (pending) throw new ConflictException('Há uma versão da ata em aprovação. Aguarde a decisão.');
      const version = draft
        ? await tx.documentVersion.update({ where: { id: draft.id }, data: { content, aiGenerated: !!aiGenerated, status: 'RASCUNHO' } })
        : await tx.documentVersion.create({
            data: {
              orgId: auth.orgId,
              documentId: doc.id,
              version: Math.max(0, ...doc.versions.map((v) => v.version)) + 1,
              content,
              aiGenerated: !!aiGenerated,
              createdById: auth.userId,
            },
          });
      await this.audit.log(auth, draft ? 'ALTERAR' : 'CRIAR', 'VersaoAta', version.id, { meetingId, version: version.version, aiGenerated }, tx);
      return version;
    });
  }
}

// ───── Gestão Documental ─────

const DOC_TYPES = ['ATA', 'POP', 'PROCEDIMENTO', 'POLITICA', 'WIKI', 'LICAO_APRENDIDA', 'RELATORIO'] as const;

@ApiTags('PMO Corporativo — Documentos')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Auth() auth: AuthCtx, @Query('projectId') projectId?: string, @Query('type') type?: string) {
    const docs = await this.prisma.document.findMany({
      where: { orgId: auth.orgId, ...(projectId ? { projectId } : {}), ...(type ? { type: type as any } : {}) },
      include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, status: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return docs.map((d) => ({ ...d, latest: d.versions[0] ?? null, versions: undefined }));
  }

  @Get(':id')
  async get(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    return findInOrg(this.prisma, 'document', id, auth.orgId, { include: { versions: { orderBy: { version: 'desc' } } } });
  }

  @Post()
  @Roles(...R.MANAGE)
  async create(@Auth() auth: AuthCtx, @Body() body: unknown) {
    const data = parseOrThrow(
      z.object({ type: z.enum(DOC_TYPES).refine((t) => t !== 'ATA', 'Atas são criadas pela Sala de Reuniões.'), title: zText(200), projectId: zOptId, content: zText(200000) }),
      body,
    );
    await assertRefs(this.prisma, auth.orgId, data, { projectId: 'project' });
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({ data: { orgId: auth.orgId, type: data.type, title: data.title, projectId: data.projectId ?? null } });
      await tx.documentVersion.create({ data: { orgId: auth.orgId, documentId: doc.id, version: 1, content: data.content, createdById: auth.userId } });
      await this.audit.log(auth, 'CRIAR', 'Documento', doc.id, { type: data.type, title: data.title }, tx);
      return doc;
    });
  }

  /** Nova versão: preserva as anteriores (aprovadas ficam imutáveis). */
  @Post(':id/versions')
  @Roles(...R.MANAGE)
  async newVersion(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { content, aiGenerated } = parseOrThrow(z.object({ content: zText(200000), aiGenerated: z.boolean().optional() }), body);
    const doc = await findInOrg<any>(this.prisma, 'document', id, auth.orgId, { include: { versions: true } });
    if (doc.versions.some((v: any) => v.status === 'RASCUNHO' || v.status === 'EM_APROVACAO')) {
      throw new ConflictException('Já existe uma versão em rascunho ou em aprovação.');
    }
    const v = await this.prisma.documentVersion.create({
      data: {
        orgId: auth.orgId,
        documentId: id,
        version: Math.max(0, ...doc.versions.map((x: any) => x.version)) + 1,
        content,
        aiGenerated: !!aiGenerated,
        createdById: auth.userId,
      },
    });
    await this.audit.log(auth, 'CRIAR', 'VersaoDocumento', v.id, { documentId: id, version: v.version });
    return v;
  }

  @Patch('versions/:versionId')
  @Roles(...R.MANAGE)
  async editVersion(@Auth() auth: AuthCtx, @Param('versionId', ParseUUIDPipe) versionId: string, @Body() body: unknown) {
    const { content } = parseOrThrow(z.object({ content: zText(200000) }), body);
    const v = await this.prisma.documentVersion.findFirst({ where: { id: versionId, orgId: auth.orgId } });
    if (!v) throw new BadRequestException('Versão não encontrada.');
    if (v.status !== 'RASCUNHO' && v.status !== 'REJEITADO') {
      throw new ConflictException('Versões em aprovação ou aprovadas são imutáveis. Crie uma nova versão.');
    }
    const updated = await this.prisma.documentVersion.update({ where: { id: versionId }, data: { content, status: 'RASCUNHO' } });
    await this.audit.log(auth, 'ALTERAR', 'VersaoDocumento', versionId, { documentId: v.documentId });
    return updated;
  }
}
