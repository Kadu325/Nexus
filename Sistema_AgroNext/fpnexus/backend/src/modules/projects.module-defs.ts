import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { crudController, z } from '../common/crud.factory';
import { R } from '../common/auth-context';
import { zOptDate, zOptId, zOptText, zText } from '../common/validation';

const PROJECT_TYPES = ['ESTRATEGICO', 'OPERACIONAL'] as const;
const PROJECT_STATUS = ['PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO'] as const;
const KANBAN = ['A_FAZER', 'EM_ANDAMENTO', 'EM_REVISAO', 'CONCLUIDA'] as const;

export const PortfolioController = crudController({
  path: 'portfolios',
  model: 'portfolio',
  entity: 'Portfolio',
  tag: 'Gestão de Projetos',
  create: z.object({ name: zText(150), description: zOptText() }),
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
  include: { _count: { select: { programs: true, projects: true } } },
});

export const ProgramController = crudController({
  path: 'programs',
  model: 'program',
  entity: 'Programa',
  tag: 'Gestão de Projetos',
  create: z.object({ name: zText(150), description: zOptText(), portfolioId: zOptId }),
  refs: { portfolioId: 'portfolio' },
  filters: ['portfolioId'],
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
  include: { portfolio: { select: { id: true, name: true } }, _count: { select: { projects: true } } },
});

const projectSchema = z.object({
  code: zText(30),
  name: zText(200),
  description: zOptText(),
  type: z.enum(PROJECT_TYPES).optional(),
  status: z.enum(PROJECT_STATUS).optional(),
  portfolioId: zOptId,
  programId: zOptId,
  parentId: zOptId,
  managerId: zOptId,
  costCenterId: zOptId,
  unitId: zOptId,
  startDate: zOptDate,
  endDate: zOptDate,
  priorityScore: z.coerce.number().int().min(1).max(5).nullable().optional(),
  wipLimits: z.record(z.enum(KANBAN), z.coerce.number().int().min(0).max(999)).optional(),
  autoCreateTasksFromActions: z.boolean().optional(),
});

export const ProjectController = crudController({
  path: 'projects',
  model: 'project',
  entity: 'Projeto',
  tag: 'Gestão de Projetos',
  create: projectSchema,
  refs: {
    portfolioId: 'portfolio',
    programId: 'program',
    parentId: 'project',
    managerId: 'member',
    costCenterId: 'costCenter',
    unitId: 'unit',
  },
  filters: ['status', 'portfolioId', 'programId', 'type', 'parentId'],
  writeRoles: R.MANAGE,
  deleteRoles: R.PMO,
  orderBy: { code: 'asc' },
  include: {
    portfolio: { select: { id: true, name: true } },
    program: { select: { id: true, name: true } },
    _count: { select: { tasks: true, children: true } },
  },
  async beforeWrite(data, { prisma, auth, existing }) {
    const start = data.startDate ?? existing?.startDate;
    const end = data.endDate ?? existing?.endDate;
    if (start && end && end < start) throw new BadRequestException('A data de término é anterior à de início.');
    if (existing && data.parentId === existing.id) throw new BadRequestException('Um projeto não pode ser subprojeto de si mesmo.');
    if (data.autoCreateTasksFromActions !== undefined && !R.PMO.includes(auth.role)) {
      throw new ForbiddenException('Somente Administrador ou PMO altera a política de automação de tarefas.');
    }
    if (data.programId && !data.portfolioId) {
      const program = await prisma.program.findUnique({ where: { id: data.programId } });
      if (program?.portfolioId) data.portfolioId = program.portfolioId;
    }
    return data;
  },
  async beforeDelete(existing, { prisma }) {
    const where = { projectId: existing.id };
    const counts = await Promise.all([
      prisma.task.count({ where }),
      prisma.meeting.count({ where }),
      prisma.risk.count({ where }),
      prisma.financialEntry.count({ where }),
      prisma.stakeholder.count({ where }),
      prisma.project.count({ where: { parentId: existing.id } }),
    ]);
    if (counts.some((c) => c > 0)) {
      throw new BadRequestException('Projeto com registros vinculados: altere o status para Cancelado em vez de excluir.');
    }
    await prisma.charter.deleteMany({ where });
    await prisma.businessCase.deleteMany({ where });
  },
});
