import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';
import { Auth, AuthCtx, R } from '../common/auth-context';
import { crudController, z } from '../common/crud.factory';
import { zDate, zDecimal, zId, zOptId, zOptText, zText } from '../common/validation';

const UF = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;

const lat = zDecimal(2, 6).refine((s) => Number(s) >= -90 && Number(s) <= 90, 'Latitude inválida.');
const lng = zDecimal(3, 6).refine((s) => Number(s) >= -180 && Number(s) <= 180, 'Longitude inválida.');

export const UnitController = crudController({
  path: 'units',
  model: 'unit',
  entity: 'Unidade',
  tag: 'Agronegócio',
  create: z.object({
    name: zText(150),
    type: z.enum(['FAZENDA', 'FILIAL', 'ARMAZEM', 'ESCRITORIO']).optional(),
    city: zOptText(100),
    state: z.enum(UF).nullable().optional(),
    latitude: lat.nullable().optional(),
    longitude: lng.nullable().optional(),
    areaHa: zDecimal(10, 2).nullable().optional(),
    costCenterId: zOptId,
  }),
  refs: { costCenterId: 'costCenter' },
  filters: ['type', 'state'],
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
  beforeWrite(data, { existing }) {
    const la = data.latitude !== undefined ? data.latitude : existing?.latitude;
    const lo = data.longitude !== undefined ? data.longitude : existing?.longitude;
    if ((la === null || la === undefined) !== (lo === null || lo === undefined)) {
      throw new BadRequestException('Informe latitude e longitude juntas.');
    }
    return data;
  },
});

export const SeasonController = crudController({
  path: 'seasons',
  model: 'season',
  entity: 'Safra',
  tag: 'Agronegócio',
  create: z.object({ name: zText(30), crop: zOptText(100), startDate: zDate, endDate: zDate }),
  writeRoles: R.PMO,
  orderBy: { startDate: 'desc' },
  beforeWrite(data, { existing }) {
    const s = data.startDate ?? existing?.startDate;
    const e = data.endDate ?? existing?.endDate;
    if (e < s) throw new BadRequestException('A safra termina antes de começar.');
    return data;
  },
});

export const AgroIndicatorController = crudController({
  path: 'agro-indicators',
  model: 'agroIndicator',
  entity: 'IndicadorAgro',
  tag: 'Agronegócio',
  create: z.object({
    name: zText(150),
    formula: zText(1000),
    unit: zText(30),
    source: zText(300),
    frequency: zText(50),
    responsible: zOptText(150),
  }),
  writeRoles: R.PMO,
  orderBy: { name: 'asc' },
});

export const AgroMeasurementController = crudController({
  path: 'agro-measurements',
  model: 'agroMeasurement',
  entity: 'MedicaoAgro',
  tag: 'Agronegócio',
  create: z.object({
    indicatorId: zId,
    unitId: zId,
    seasonId: zOptId,
    projectId: zOptId,
    refDate: zDate,
    value: zDecimal(14, 4),
    origin: z.enum(['MANUAL', 'INTEGRACAO', 'SENSOR']).optional(),
  }),
  refs: { indicatorId: 'agroIndicator', unitId: 'unit', seasonId: 'season', projectId: 'project' },
  filters: ['indicatorId', 'unitId', 'seasonId', 'projectId'],
  readRoles: R.ALL,
  writeRoles: R.WORKERS,
  orderBy: { refDate: 'desc' },
  beforeWrite(data, { auth, existing }) {
    if (!existing) data.createdById = auth.userId;
    return data;
  },
});

@ApiTags('Agronegócio')
@Controller('agro')
export class AgroController {
  constructor(private readonly prisma: PrismaService) {}

  /** Pontos do mapa: unidades com coordenadas válidas; as demais aparecem como "sem localização". */
  @Get('map')
  async map(@Auth() auth: AuthCtx) {
    const [units, projects] = await Promise.all([
      this.prisma.unit.findMany({ where: { orgId: auth.orgId }, orderBy: { name: 'asc' } }),
      this.prisma.project.groupBy({ by: ['unitId'], where: { orgId: auth.orgId, unitId: { not: null } }, _count: true }),
    ]);
    const counts = new Map(projects.map((p) => [p.unitId, p._count]));
    const withCoords = units.filter((u) => u.latitude !== null && u.longitude !== null);
    const byState: Record<string, number> = {};
    for (const p of projects) {
      const u = units.find((x) => x.id === p.unitId);
      if (u?.state) byState[u.state] = (byState[u.state] ?? 0) + p._count;
    }
    return {
      points: withCoords.map((u) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        city: u.city,
        state: u.state,
        lat: Number(u.latitude),
        lng: Number(u.longitude),
        areaHa: u.areaHa === null ? null : Number(u.areaHa),
        projects: counts.get(u.id) ?? 0,
        isDemo: u.isDemo,
      })),
      withoutLocation: units.filter((u) => u.latitude === null || u.longitude === null).map((u) => ({ id: u.id, name: u.name })),
      projectsByState: byState,
      provider: 'Contorno do Brasil embarcado (Natural Earth, domínio público); sem provedor de mapas externo.',
    };
  }

  /** Série de um indicador por unidade; leituras ausentes permanecem ausentes (sem interpolação). */
  @Get('series')
  async series(@Auth() auth: AuthCtx, @Query('indicatorId') indicatorId: string, @Query('seasonId') seasonId?: string) {
    if (!indicatorId) throw new BadRequestException('Informe o indicador.');
    const indicator = await this.prisma.agroIndicator.findFirst({ where: { id: indicatorId, orgId: auth.orgId } });
    if (!indicator) throw new BadRequestException('Indicador não encontrado.');
    const rows = await this.prisma.agroMeasurement.findMany({
      where: { orgId: auth.orgId, indicatorId, ...(seasonId ? { seasonId } : {}) },
      orderBy: { refDate: 'asc' },
    });
    const units = await this.prisma.unit.findMany({ where: { orgId: auth.orgId, id: { in: [...new Set(rows.map((r) => r.unitId))] } } });
    return {
      indicator,
      units: units.map((u) => ({ id: u.id, name: u.name })),
      rows: rows.map((r) => ({ unitId: r.unitId, date: r.refDate.toISOString().slice(0, 10), value: Number(r.value), origin: r.origin })),
    };
  }
}
