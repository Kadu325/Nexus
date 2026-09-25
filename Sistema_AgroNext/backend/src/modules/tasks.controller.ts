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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma, TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../common/audit.service';
import { Auth, AuthCtx, R, Roles } from '../common/auth-context';
import { assertRefs, findInOrg } from '../common/org-scope';
import { parseOrThrow, zId, zOptDate, zOptId, zOptText, zPosMoney, zTags, zText } from '../common/validation';
import { computeCpm, wouldCreateCycle } from '../domain/cpm';
import { isoDate, toDateOnly, workdaysBetween } from '../domain/dates';

const STATUS = ['A_FAZER', 'EM_ANDAMENTO', 'EM_REVISAO', 'CONCLUIDA'] as const;
const PRIORITY = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
const PRIORITY_RANK: Record<string, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3 };
const est = z.coerce.number().min(0).max(10000).nullable().optional();

const taskFields = {
  parentId: zOptId,
  wbsCode: z.string().trim().max(30).nullable().optional(),
  title: zText(300),
  description: zOptText(10000),
  status: z.enum(STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  assigneeId: zOptId,
  startDate: zOptDate,
  endDate: zOptDate,
  isMilestone: z.boolean().optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  budget: zPosMoney.optional(),
  estOptimistic: est,
  estLikely: est,
  estPessimistic: est,
  tags: zTags,
};
const createSchema = z.object({ projectId: zId, ...taskFields });
const updateSchema = z
  .object(taskFields)
  .partial()
  .extend({ version: z.coerce.number().int().optional(), overrideWip: z.boolean().optional() });
const MEMBER_FIELDS = new Set(['status', 'progress', 'version', 'overrideWip']);

type TaskInput = Record<string, any>;

function validateTask(t: TaskInput) {
  if (t.startDate && t.endDate && t.endDate < t.startDate) throw new BadRequestException('O término é anterior ao início.');
  const { estOptimistic: o, estLikely: m, estPessimistic: p } = t;
  const given = [o, m, p].filter((v) => v !== null && v !== undefined).length;
  if (given > 0 && given < 3) throw new BadRequestException('Informe as três estimativas (otimista, mais provável, pessimista) ou nenhuma.');
  if (given === 3 && !(o <= m && m <= p)) throw new BadRequestException('Estimativas devem obedecer otimista ≤ mais provável ≤ pessimista.');
}

@ApiTags('Gestão de Projetos')
@Controller()
export class TasksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('projects/:id/tasks')
  async list(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const tasks = await this.prisma.task.findMany({
      where: { orgId: auth.orgId, projectId },
      orderBy: [{ wbsCode: 'asc' }, { createdAt: 'asc' }],
    });
    const dependencies = await this.prisma.taskDependency.findMany({
      where: { orgId: auth.orgId, successorId: { in: tasks.map((t) => t.id) } },
    });
    return { tasks, dependencies };
  }

  /** Gantt/cronograma: tarefas agendadas, não agendadas, caminho crítico e linha de base mais recente. */
  @Get('projects/:id/schedule')
  async schedule(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string) {
    const project = await findInOrg<any>(this.prisma, 'project', projectId, auth.orgId);
    const { tasks, dependencies } = await this.list(auth, projectId);
    const scheduled = tasks.filter((t) => t.startDate && t.endDate);
    const unscheduled = tasks.filter((t) => !t.startDate || !t.endDate);
    const schedIds = new Set(scheduled.map((t) => t.id));
    const edges = dependencies
      .filter((d) => schedIds.has(d.predecessorId) && schedIds.has(d.successorId))
      .map((d) => ({ from: d.predecessorId, to: d.successorId }));
    let cpm: ReturnType<typeof computeCpm> | null = null;
    let cpmError: string | null = null;
    try {
      cpm = computeCpm(
        scheduled.map((t) => ({ id: t.id, duration: t.isMilestone ? 0 : workdaysBetween(t.startDate!, t.endDate!) })),
        edges,
      );
    } catch (e) {
      cpmError = (e as Error).message;
    }
    const baseline = await this.prisma.baseline.findFirst({
      where: { orgId: auth.orgId, projectId },
      orderBy: { number: 'desc' },
      include: { items: true },
    });
    const range = scheduled.length
      ? {
          start: isoDate(new Date(Math.min(...scheduled.map((t) => t.startDate!.getTime())))),
          end: isoDate(new Date(Math.max(...scheduled.map((t) => t.endDate!.getTime())))),
        }
      : null;
    return {
      project: { id: project.id, name: project.name, code: project.code },
      range,
      calendar: 'Segunda a sexta-feira; feriados não cadastrados (etapa 1).',
      scheduled: scheduled.map((t) => ({
        ...t,
        durationWorkdays: t.isMilestone ? 0 : workdaysBetween(t.startDate!, t.endDate!),
        float: cpm?.nodes[t.id]?.float ?? null,
        critical: cpm?.nodes[t.id]?.critical ?? false,
      })),
      unscheduled,
      dependencies,
      criticalPath: cpm?.criticalPath ?? [],
      projectDurationWorkdays: cpm?.projectDuration ?? null,
      cpmError,
      baseline: baseline
        ? { number: baseline.number, createdAt: baseline.createdAt, items: baseline.items }
        : null,
    };
  }

  @Get('projects/:id/baselines')
  async baselines(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    const rows = await this.prisma.baseline.findMany({
      where: { orgId: auth.orgId, projectId },
      orderBy: { number: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return rows;
  }

  @Post('projects/:id/baselines')
  @Roles(...R.MANAGE)
  async createBaseline(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) projectId: string) {
    await findInOrg(this.prisma, 'project', projectId, auth.orgId);
    return this.prisma.$transaction(
      async (tx) => {
        const tasks = await tx.task.findMany({ where: { orgId: auth.orgId, projectId } });
        if (tasks.length === 0) throw new BadRequestException('O projeto não possui tarefas para registrar a linha de base.');
        const last = await tx.baseline.findFirst({ where: { projectId }, orderBy: { number: 'desc' } });
        const baseline = await tx.baseline.create({
          data: {
            orgId: auth.orgId,
            projectId,
            number: (last?.number ?? 0) + 1,
            createdById: auth.userId,
            items: {
              create: tasks.map((t) => ({ taskId: t.id, startDate: t.startDate, endDate: t.endDate, budget: t.budget })),
            },
          },
        });
        await this.audit.log(auth, 'CRIAR', 'LinhaDeBase', baseline.id, { projectId, number: baseline.number, tarefas: tasks.length }, tx);
        return baseline;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Get('my-work')
  async myWork(@Auth() auth: AuthCtx) {
    const tasks = await this.prisma.task.findMany({
      where: { orgId: auth.orgId, assigneeId: auth.userId, status: { not: 'CONCLUIDA' } },
      include: { project: { select: { id: true, name: true, code: true } } },
    });
    const today = toDateOnly(new Date());
    return tasks
      .map((t) => ({ ...t, overdue: !!t.endDate && t.endDate < today, scheduled: !!(t.startDate && t.endDate) }))
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.endDate?.getTime() ?? Infinity) - (b.endDate?.getTime() ?? Infinity),
      );
  }

  @Get('tasks/:id')
  async get(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const task = await findInOrg<any>(this.prisma, 'task', id, auth.orgId, {
      include: { project: { select: { id: true, name: true, code: true } } },
    });
    const [comments, predecessors, successors, action] = await Promise.all([
      this.prisma.taskComment.findMany({ where: { orgId: auth.orgId, taskId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.taskDependency.findMany({ where: { orgId: auth.orgId, successorId: id } }),
      this.prisma.taskDependency.findMany({ where: { orgId: auth.orgId, predecessorId: id } }),
      task.sourceActionId
        ? this.prisma.meetingAction.findFirst({ where: { id: task.sourceActionId, orgId: auth.orgId }, include: { meeting: { select: { id: true, title: true } } } })
        : null,
    ]);
    return { ...task, comments, predecessors, successors, sourceAction: action };
  }

  @Post('tasks')
  @Roles(...R.MANAGE)
  async create(@Auth() auth: AuthCtx, @Body() body: unknown) {
    const data = parseOrThrow(createSchema, body) as TaskInput;
    await assertRefs(this.prisma, auth.orgId, data, { projectId: 'project', parentId: 'task', assigneeId: 'member' });
    validateTask(data);
    if (data.parentId) {
      const parent = await this.prisma.task.findUnique({ where: { id: data.parentId } });
      if (parent?.projectId !== data.projectId) throw new BadRequestException('A tarefa-mãe pertence a outro projeto.');
    }
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          ...(data as Prisma.TaskUncheckedCreateInput),
          orgId: auth.orgId,
          createdById: auth.userId,
          completedAt: data.status === 'CONCLUIDA' ? new Date() : null,
        },
      });
      if (task.progress > 0) await tx.progressLog.create({ data: { orgId: auth.orgId, taskId: task.id, progress: task.progress } });
      if (task.assigneeId && task.assigneeId !== auth.userId) {
        await tx.notification.create({
          data: { orgId: auth.orgId, userId: task.assigneeId, title: 'Nova tarefa atribuída', body: task.title, link: `/projetos/${task.projectId}?tarefa=${task.id}` },
        });
      }
      await this.audit.log(auth, 'CRIAR', 'Tarefa', task.id, data, tx);
      return task;
    });
  }

  @Patch('tasks/:id')
  @Roles(...R.WORKERS)
  async update(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const input = parseOrThrow(updateSchema, body) as TaskInput;
    const existing = await findInOrg<any>(this.prisma, 'task', id, auth.orgId);

    if (auth.role === 'MEMBRO') {
      if (existing.assigneeId !== auth.userId) throw new ForbiddenException('Membros alteram apenas as tarefas atribuídas a eles.');
      const extra = Object.keys(input).filter((k) => !MEMBER_FIELDS.has(k));
      if (extra.length) throw new ForbiddenException(`Membros podem alterar apenas status e avanço (campos recusados: ${extra.join(', ')}).`);
    }
    if (input.version !== undefined && input.version !== existing.version) {
      throw new ConflictException({ message: 'A tarefa foi alterada por outra pessoa. Recarregue antes de salvar.', code: 'VERSAO' });
    }
    const { overrideWip, ...data } = input;
    delete data.version;
    await assertRefs(this.prisma, auth.orgId, data, { parentId: 'task', assigneeId: 'member' });
    if (data.parentId === id) throw new BadRequestException('Uma tarefa não pode ser subtarefa de si mesma.');
    validateTask({ ...existing, ...data });

    const statusChanged = data.status && data.status !== existing.status;
    if (statusChanged) {
      const project = await this.prisma.project.findUniqueOrThrow({ where: { id: existing.projectId } });
      const limit = (project.wipLimits as unknown as Record<string, number> | null)?.[data.status];
      if (limit && limit > 0) {
        const count = await this.prisma.task.count({ where: { projectId: existing.projectId, status: data.status, id: { not: id } } });
        if (count >= limit && !overrideWip) {
          throw new ConflictException({ message: `Limite WIP da coluna atingido (${count}/${limit}).`, code: 'WIP_LIMIT', count, limit });
        }
        if (count >= limit) await this.audit.log(auth, 'WIP_EXCEDIDO', 'Tarefa', id, { status: data.status, count, limit });
      }
      if (data.status === 'CONCLUIDA') {
        data.completedAt = new Date();
        if (data.progress === undefined) data.progress = 100;
      } else if (existing.status === 'CONCLUIDA') {
        data.completedAt = null;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // atualização condicionada à versão lida: evita sobrescrever alteração concorrente
      const res = await tx.task.updateMany({
        where: { id, orgId: auth.orgId, version: existing.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (res.count === 0) throw new ConflictException({ message: 'A tarefa foi alterada por outra pessoa. Recarregue.', code: 'VERSAO' });
      const task = await tx.task.findUniqueOrThrow({ where: { id } });
      if (data.progress !== undefined && data.progress !== existing.progress) {
        await tx.progressLog.create({ data: { orgId: auth.orgId, taskId: id, progress: data.progress } });
      }
      if (statusChanged && task.sourceActionId) await this.syncAction(tx, auth, task.sourceActionId, task.status);
      if (data.assigneeId && data.assigneeId !== existing.assigneeId && data.assigneeId !== auth.userId) {
        await tx.notification.create({
          data: { orgId: auth.orgId, userId: data.assigneeId, title: 'Tarefa atribuída a você', body: task.title, link: `/projetos/${task.projectId}?tarefa=${id}` },
        });
      }
      await this.audit.log(auth, 'ALTERAR', 'Tarefa', id, { antes: pick(existing, Object.keys(data)), depois: data }, tx);
      return task;
    });
  }

  /** Sincronização Ata × Tarefa (sistema.md, Prioridade 5): o conteúdo da ata não muda, apenas o status da ação. */
  private async syncAction(tx: Prisma.TransactionClient, auth: AuthCtx, actionId: string, status: TaskStatus) {
    const done = status === 'CONCLUIDA';
    await tx.meetingAction.updateMany({
      where: { id: actionId, orgId: auth.orgId },
      data: done
        ? { status: 'CONCLUIDA', completedAt: new Date(), completedById: auth.userId }
        : { status: 'CONVERTIDA', completedAt: null, completedById: null },
    });
    await this.audit.log(auth, done ? 'ACAO_CONCLUIDA' : 'ACAO_REABERTA', 'AcaoReuniao', actionId, { origem: 'tarefa' }, tx);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  @Roles(...R.MANAGE)
  async remove(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const task = await findInOrg<any>(this.prisma, 'task', id, auth.orgId);
    if (await this.prisma.task.count({ where: { parentId: id } })) throw new ConflictException('Exclua ou mova as subtarefas antes.');
    if (await this.prisma.timeEntry.count({ where: { taskId: id } })) throw new ConflictException('Há horas apontadas nesta tarefa.');
    await this.prisma.$transaction(async (tx) => {
      await tx.taskDependency.deleteMany({ where: { OR: [{ predecessorId: id }, { successorId: id }] } });
      await tx.taskComment.deleteMany({ where: { taskId: id } });
      if (task.sourceActionId) {
        await tx.meetingAction.updateMany({ where: { id: task.sourceActionId }, data: { status: 'VALIDADA', taskId: null } });
      }
      await tx.task.delete({ where: { id } });
      await this.audit.log(auth, 'EXCLUIR', 'Tarefa', id, task, tx);
    });
  }

  @Post('tasks/:id/dependencies')
  @Roles(...R.MANAGE)
  async addDependency(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) successorId: string, @Body() body: unknown) {
    const { predecessorId } = parseOrThrow(z.object({ predecessorId: zId }), body);
    const succ = await findInOrg<any>(this.prisma, 'task', successorId, auth.orgId);
    const pred = await findInOrg<any>(this.prisma, 'task', predecessorId, auth.orgId);
    if (pred.projectId !== succ.projectId) throw new BadRequestException('Dependências entre projetos diferentes não são suportadas na etapa 1.');
    const tasks = await this.prisma.task.findMany({ where: { projectId: succ.projectId }, select: { id: true } });
    const ids = tasks.map((t) => t.id);
    const deps = await this.prisma.taskDependency.findMany({ where: { orgId: auth.orgId, predecessorId: { in: ids } } });
    if (wouldCreateCycle(ids, deps.map((d) => ({ from: d.predecessorId, to: d.successorId })), { from: predecessorId, to: successorId })) {
      throw new BadRequestException('Essa dependência criaria um ciclo.');
    }
    const dep = await this.prisma.taskDependency.create({ data: { orgId: auth.orgId, predecessorId, successorId } });
    await this.audit.log(auth, 'CRIAR', 'Dependencia', dep.id, { predecessorId, successorId });
    return dep;
  }

  @Delete('dependencies/:id')
  @HttpCode(204)
  @Roles(...R.MANAGE)
  async removeDependency(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) id: string) {
    const dep = await this.prisma.taskDependency.findFirst({ where: { id, orgId: auth.orgId } });
    if (!dep) throw new BadRequestException('Dependência não encontrada.');
    await this.prisma.taskDependency.delete({ where: { id } });
    await this.audit.log(auth, 'EXCLUIR', 'Dependencia', id, dep);
  }

  @Post('tasks/:id/comments')
  @Roles(...R.WORKERS)
  async comment(@Auth() auth: AuthCtx, @Param('id', ParseUUIDPipe) taskId: string, @Body() body: unknown) {
    const { body: text } = parseOrThrow(z.object({ body: zText(5000) }), body);
    await findInOrg(this.prisma, 'task', taskId, auth.orgId);
    const c = await this.prisma.taskComment.create({ data: { orgId: auth.orgId, taskId, userId: auth.userId, body: text } });
    await this.audit.log(auth, 'CRIAR', 'Comentario', c.id, { taskId });
    return c;
  }
}

function pick(obj: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, obj[k]]));
}
