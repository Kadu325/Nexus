import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgroService {
  constructor(private prisma: PrismaService) {}

  async getIndicatorsByUnit(unitId: string, organizationId: string) {
    const unit = await this.prisma.agriculturalUnit.findFirst({
      where: { id: unitId, organizationId }
    });

    if (!unit) throw new UnauthorizedException('Unidade agrícola não encontrada neste tenant.');

    return this.prisma.agroIndicator.findMany({
      where: { agriculturalUnitId: unitId },
      orderBy: { readingDate: 'desc' }
    });
  }
}