import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './common/prisma.service';
import { AuditService } from './common/audit.service';
import { AuthGuard } from './common/auth.guard';
import { ErrorsFilter } from './common/errors.filter';
import { Public } from './common/auth-context';
import { AuthController } from './auth/auth.controller';
import { AdminController } from './modules/admin.controller';
import { PortfolioController, ProgramController, ProjectController } from './modules/projects.module-defs';
import { TasksController } from './modules/tasks.controller';
import { ApprovalsController, ApprovalsService } from './modules/approvals';
import { ContractController, PmoController, RiskController, StakeholderController } from './modules/pmo.controller';
import { DocumentsController, MeetingCrudController, MeetingsController } from './modules/meetings.controller';
import { CostCenterController, FinanceController, FinancialEntryController } from './modules/finance.controller';
import { EvmService } from './modules/evm.service';
import { AllocationController, ResourceController, ResourcesController } from './modules/resources.controller';
import {
  ChangeRequestController,
  ControlController,
  FrameworkController,
  GovernanceController,
  ItSystemController,
  NonConformityController,
} from './modules/governance.controller';
import { AgroController, AgroIndicatorController, AgroMeasurementController, SeasonController, UnitController } from './modules/agro.controller';
import { AiController, AiProvider } from './modules/ai.controller';
import { AnalyticsController } from './modules/analytics.controller';

@ApiTags('Operação')
@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'erro', database: 'indisponível' });
    }
  }
}

@Module({
  controllers: [
    HealthController,
    AuthController,
    AdminController,
    // Gestão de Projetos
    PortfolioController,
    ProgramController,
    ProjectController,
    TasksController,
    // PMO Corporativo
    PmoController,
    ApprovalsController,
    StakeholderController,
    RiskController,
    ContractController,
    MeetingCrudController,
    MeetingsController,
    DocumentsController,
    // Gestão Financeira
    CostCenterController,
    FinancialEntryController,
    FinanceController,
    // Gestão de Recursos
    ResourceController,
    AllocationController,
    ResourcesController,
    // Governança de TI e Compliance Tecnológico
    ItSystemController,
    ChangeRequestController,
    FrameworkController,
    ControlController,
    NonConformityController,
    GovernanceController,
    // Agronegócio
    UnitController,
    SeasonController,
    AgroIndicatorController,
    AgroMeasurementController,
    AgroController,
    // IA e Analytics
    AiController,
    AnalyticsController,
  ],
  providers: [
    PrismaService,
    AuditService,
    ApprovalsService,
    EvmService,
    AiProvider,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorsFilter },
  ],
})
export class AppModule {}
