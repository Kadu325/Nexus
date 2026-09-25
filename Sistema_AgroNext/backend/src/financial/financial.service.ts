import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  async getProjectIndicators(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!project) throw new UnauthorizedException("Acesso negado ao projeto.");

    const financials = await this.prisma.projectFinancials.findUnique({
      where: { projectId },
    });

    if (!financials) {
      return {
        EV: 0,
        AC: 0,
        PV: 0,
        CPI: { value: null, reason: "Dados financeiros não configurados." },
        SPI: { value: null, reason: "Dados financeiros não configurados." },
      };
    }

    const ev = Number(financials.earnedValue);
    const ac = Number(financials.actualCost);
    const pv = Number(financials.plannedValue);

    const cpi = ac > 0 ? (ev / ac).toFixed(2) : null;
    const cpiReason =
      ac === 0 ? "AC (Custo Real) é zero ou indisponível." : null;

    const spi = pv > 0 ? (ev / pv).toFixed(2) : null;
    const spiReason =
      pv === 0 ? "PV (Valor Planejado) é zero ou indisponível." : null;

    return {
      EV: ev,
      AC: ac,
      PV: pv,
      CPI: { value: cpi, reason: cpiReason },
      SPI: { value: spi, reason: spiReason },
    };
  }
}
