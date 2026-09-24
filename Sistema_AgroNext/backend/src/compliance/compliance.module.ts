import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ComplianceController } from './compliance.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ComplianceController],
  providers: [AuditService, PrismaService],
  exports: [AuditService], // Exportado para uso no MeetingsModule e outros
})
export class ComplianceModule {}