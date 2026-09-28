import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { computeEvm } from '../domain/evm';
import { addDays, toDateOnly } from '../domain/dates';
import { centsToNumber, toCents } from '../domain/money';

/** Monta os dados de EVM de um projeto a partir da linha de base, do histórico de avanço e das despesas realizadas. */
@Injectable()
export class EvmService {
  constructor(private readonly prisma: PrismaService) {}

  async acEntries(orgId: string, projectId: string) {
    const rows = await this.prisma.financialEntry.findMany({
      where: { orgId, projectId, nature: 'DESPESA', status: 'REALIZADO' },
      select: { competenceDate: true, amount: true },
    });
    return rows.map((r) => ({ date: r.competenceDate, amountCents: toCents(r.amount) }));
  }

  async baselineItems(orgId: string, projectId: string) {
    const b = await this.prisma.baseline.findFirst({ where: { orgId, projectId }, orderBy: { number: 'desc' }, include: { items: true } });
    return b
      ? { number: b.number, items: b.items.map((i) => ({ taskId: i.taskId, start: i.startDate, end: i.endDate, budgetCents: toCents(i.budget) })) }
      : null;
  }

  async progressAt(orgId: string, taskIds: string[], cut: Date) {
    const logs = await this.prisma.progressLog.findMany({
      where: { orgId, taskId: { in: taskIds }, recordedAt: { lt: addDays(cut, 1) } },
      orderBy: { recordedAt: 'asc' },
    });
    const map = new Map<string, number>();
    for (const l of logs) map.set(l.taskId, l.progress);
    return map;
  }

  async evm(orgId: string, projectId: string, cutDate?: Date) {
    const cut = toDateOnly(cutDate ?? new Date());
    const baseline = await this.baselineItems(orgId, projectId);
    const progress = baseline ? await this.progressAt(orgId, baseline.items.map((i) => i.taskId), cut) : new Map<string, number>();
    const r = computeEvm({
      cutDate: cut,
      baseline: baseline?.items ?? null,
      progressAt: (id) => progress.get(id) ?? 0,
      acEntries: await this.acEntries(orgId, projectId),
    });
    return {
      ...r,
      baselineNumber: baseline?.number ?? null,
      bac: centsToNumber(r.bacCents),
      pv: r.pvCents === null ? null : centsToNumber(r.pvCents),
      ev: r.evCents === null ? null : centsToNumber(r.evCents),
      ac: centsToNumber(r.acCents),
      eac: r.eacCents === null ? null : centsToNumber(r.eacCents),
      cvValue: r.cv === null ? null : centsToNumber(r.cv),
      svValue: r.sv === null ? null : centsToNumber(r.sv),
    };
  }
}
