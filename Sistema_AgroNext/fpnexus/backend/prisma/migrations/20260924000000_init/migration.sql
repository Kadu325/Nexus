-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PMO', 'GERENTE', 'MEMBRO', 'LEITOR');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('ESTRATEGICO', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('A_FAZER', 'EM_ANDAMENTO', 'EM_REVISAO', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('RASCUNHO', 'EM_APROVACAO', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "CaseLineKind" AS ENUM ('BENEFICIO', 'CUSTO');

-- CreateEnum
CREATE TYPE "ApprovalEntity" AS ENUM ('TAP', 'BUSINESS_CASE', 'DOCUMENTO', 'MUDANCA');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('ABERTO', 'MITIGANDO', 'OCORRIDO', 'FECHADO');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('EM_NEGOCIACAO', 'VIGENTE', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('REUNIAO', 'COMITE', 'KICKOFF', 'STATUS_REPORT', 'ENCERRAMENTO');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('EM_REVISAO', 'VALIDADA', 'CONVERTIDA', 'CONCLUIDA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ATA', 'POP', 'PROCEDIMENTO', 'POLITICA', 'WIKI', 'LICAO_APRENDIDA', 'RELATORIO');

-- CreateEnum
CREATE TYPE "EntryNature" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('CAPEX', 'OPEX');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PREVISTO', 'REALIZADO');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('MANUAL', 'ERP', 'IMPORTACAO');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('RECURSOS', 'EQUIPAMENTOS', 'FORNECEDORES', 'SERVICOS', 'MATERIAIS', 'OUTROS');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PESSOA', 'EQUIPAMENTO', 'MAQUINA', 'VEICULO', 'CONSULTOR');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('RASCUNHO', 'SUBMETIDO', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "Lifecycle" AS ENUM ('EM_AVALIACAO', 'EM_PRODUCAO', 'EM_DESCONTINUACAO', 'DESCONTINUADO');

-- CreateEnum
CREATE TYPE "ControlFrequency" AS ENUM ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "AssessmentResult" AS ENUM ('CONFORME', 'PARCIAL', 'NAO_CONFORME', 'NAO_AVALIADO');

-- CreateEnum
CREATE TYPE "NcStatus" AS ENUM ('ABERTA', 'EM_TRATAMENTO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "NcSource" AS ENUM ('COMPLIANCE', 'QUALIDADE', 'AUDITORIA');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('FAZENDA', 'FILIAL', 'ARMAZEM', 'ESCRITORIO');

-- CreateEnum
CREATE TYPE "MeasurementOrigin" AS ENUM ('MANUAL', 'INTEGRACAO', 'SENSOR');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "riskAppetite" INTEGER NOT NULL DEFAULT 9,
    "aiDailyLimit" INTEGER NOT NULL DEFAULT 100,
    "timesheetLockedUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "portfolioId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectType" NOT NULL DEFAULT 'OPERACIONAL',
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANEJAMENTO',
    "portfolioId" TEXT,
    "programId" TEXT,
    "parentId" TEXT,
    "managerId" TEXT,
    "costCenterId" TEXT,
    "unitId" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "priorityScore" INTEGER,
    "wipLimits" JSONB NOT NULL DEFAULT '{}',
    "autoCreateTasksFromActions" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "wbsCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'A_FAZER',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "assigneeId" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "budget" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "estOptimistic" DOUBLE PRECISION,
    "estLikely" DOUBLE PRECISION,
    "estPessimistic" DOUBLE PRECISION,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3),
    "sourceActionId" TEXT,
    "createdById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baseline" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineTask" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "budget" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BaselineTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "objectives" TEXT,
    "scope" TEXT,
    "assumptions" TEXT,
    "constraints" TEXT,
    "sponsor" TEXT,
    "stakeholdersText" TEXT,
    "budget" DECIMAL(18,2),
    "macroSchedule" TEXT,
    "status" "ApprovalState" NOT NULL DEFAULT 'RASCUNHO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "justification" TEXT,
    "feasibility" TEXT,
    "benefitsText" TEXT,
    "status" "ApprovalState" NOT NULL DEFAULT 'RASCUNHO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCaseLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "businessCaseId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "kind" "CaseLineKind" NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BusinessCaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "entityType" "ApprovalEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "ApprovalDecision" NOT NULL DEFAULT 'PENDENTE',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "role" TEXT,
    "contact" TEXT,
    "power" INTEGER NOT NULL,
    "interest" INTEGER NOT NULL,
    "attitude" TEXT,
    "strategy" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "probability" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "response" TEXT,
    "ownerId" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'ABERTO',
    "contingency" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "costCenterId" TEXT,
    "supplier" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "totalValue" DECIMAL(18,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'EM_NEGOCIACAO',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL DEFAULT 'REUNIAO',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingDecision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rawText" TEXT,
    "assigneeId" TEXT,
    "candidateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dueDate" DATE,
    "dueDateRaw" TEXT,
    "suggestedDueDate" DATE,
    "issues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "ActionStatus" NOT NULL DEFAULT 'EM_REVISAO',
    "taskId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "meetingId" TEXT,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ApprovalState" NOT NULL DEFAULT 'RASCUNHO',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "costCenterId" TEXT,
    "contractId" TEXT,
    "nature" "EntryNature" NOT NULL,
    "expenseType" "ExpenseType",
    "category" "CostCategory" NOT NULL DEFAULT 'OUTROS',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "competenceDate" DATE NOT NULL,
    "cashDate" DATE,
    "status" "EntryStatus" NOT NULL DEFAULT 'PREVISTO',
    "source" "EntrySource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "userId" TEXT,
    "weeklyCapacityHours" DECIMAL(6,2),
    "costPerHour" DECIMAL(18,2),
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "hoursPerWeek" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'RASCUNHO',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItSystem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "ownerId" TEXT,
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIA',
    "lifecycle" "Lifecycle" NOT NULL DEFAULT 'EM_PRODUCAO',
    "endOfSupport" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "systemId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "justification" TEXT,
    "risk" "Criticality" NOT NULL DEFAULT 'MEDIA',
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "rollbackPlan" TEXT,
    "status" "ApprovalState" NOT NULL DEFAULT 'RASCUNHO',
    "implementedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requirementRef" TEXT,
    "ownerId" TEXT,
    "frequency" "ControlFrequency" NOT NULL DEFAULT 'ANUAL',
    "lastResult" "AssessmentResult" NOT NULL DEFAULT 'NAO_AVALIADO',
    "lastAssessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "collectedAt" DATE NOT NULL,
    "supersededById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "result" "AssessmentResult" NOT NULL,
    "notes" TEXT,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "controlId" TEXT,
    "projectId" TEXT,
    "source" "NcSource" NOT NULL DEFAULT 'COMPLIANCE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actionPlan" TEXT,
    "ownerId" TEXT,
    "dueDate" DATE,
    "status" "NcStatus" NOT NULL DEFAULT 'ABERTA',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'FAZENDA',
    "city" TEXT,
    "state" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "areaHa" DECIMAL(12,2),
    "costCenterId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "crop" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroIndicator" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "responsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroMeasurement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "seasonId" TEXT,
    "projectId" TEXT,
    "refDate" DATE NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "origin" "MeasurementOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_orgId_userId_readAt_idx" ON "Notification"("orgId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "Portfolio_orgId_idx" ON "Portfolio"("orgId");

-- CreateIndex
CREATE INDEX "Program_orgId_idx" ON "Program"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_orgId_code_key" ON "Project"("orgId", "code");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_sourceActionId_key" ON "Task"("sourceActionId");

-- CreateIndex
CREATE INDEX "Task_orgId_projectId_idx" ON "Task"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "Task_orgId_assigneeId_idx" ON "Task"("orgId", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_predecessorId_successorId_key" ON "TaskDependency"("predecessorId", "successorId");

-- CreateIndex
CREATE INDEX "TaskDependency_orgId_idx" ON "TaskDependency"("orgId");

-- CreateIndex
CREATE INDEX "TaskComment_orgId_taskId_idx" ON "TaskComment"("orgId", "taskId");

-- CreateIndex
CREATE INDEX "ProgressLog_orgId_taskId_recordedAt_idx" ON "ProgressLog"("orgId", "taskId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Baseline_projectId_number_key" ON "Baseline"("projectId", "number");

-- CreateIndex
CREATE INDEX "Baseline_orgId_idx" ON "Baseline"("orgId");

-- CreateIndex
CREATE INDEX "BaselineTask_baselineId_idx" ON "BaselineTask"("baselineId");

-- CreateIndex
CREATE UNIQUE INDEX "Charter_projectId_key" ON "Charter"("projectId");

-- CreateIndex
CREATE INDEX "Charter_orgId_idx" ON "Charter"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessCase_projectId_key" ON "BusinessCase"("projectId");

-- CreateIndex
CREATE INDEX "BusinessCase_orgId_idx" ON "BusinessCase"("orgId");

-- CreateIndex
CREATE INDEX "BusinessCaseLine_orgId_businessCaseId_idx" ON "BusinessCaseLine"("orgId", "businessCaseId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_orgId_status_idx" ON "ApprovalRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "Stakeholder_orgId_projectId_idx" ON "Stakeholder"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "Risk_orgId_projectId_idx" ON "Risk"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "Contract_orgId_idx" ON "Contract"("orgId");

-- CreateIndex
CREATE INDEX "Meeting_orgId_projectId_idx" ON "Meeting"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "MeetingDecision_orgId_meetingId_idx" ON "MeetingDecision"("orgId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAction_taskId_key" ON "MeetingAction"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAction_meetingId_fingerprint_key" ON "MeetingAction"("meetingId", "fingerprint");

-- CreateIndex
CREATE INDEX "MeetingAction_orgId_status_idx" ON "MeetingAction"("orgId", "status");

-- CreateIndex
CREATE INDEX "Document_orgId_projectId_idx" ON "Document"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "Document_orgId_meetingId_idx" ON "Document"("orgId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "DocumentVersion_orgId_idx" ON "DocumentVersion"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_orgId_code_key" ON "CostCenter"("orgId", "code");

-- CreateIndex
CREATE INDEX "FinancialEntry_orgId_projectId_idx" ON "FinancialEntry"("orgId", "projectId");

-- CreateIndex
CREATE INDEX "FinancialEntry_orgId_competenceDate_idx" ON "FinancialEntry"("orgId", "competenceDate");

-- CreateIndex
CREATE INDEX "Resource_orgId_idx" ON "Resource"("orgId");

-- CreateIndex
CREATE INDEX "Allocation_orgId_resourceId_idx" ON "Allocation"("orgId", "resourceId");

-- CreateIndex
CREATE INDEX "TimeEntry_orgId_userId_date_idx" ON "TimeEntry"("orgId", "userId", "date");

-- CreateIndex
CREATE INDEX "ItSystem_orgId_idx" ON "ItSystem"("orgId");

-- CreateIndex
CREATE INDEX "ChangeRequest_orgId_idx" ON "ChangeRequest"("orgId");

-- CreateIndex
CREATE INDEX "Framework_orgId_idx" ON "Framework"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Control_orgId_frameworkId_code_key" ON "Control"("orgId", "frameworkId", "code");

-- CreateIndex
CREATE INDEX "Evidence_orgId_controlId_idx" ON "Evidence"("orgId", "controlId");

-- CreateIndex
CREATE INDEX "Assessment_orgId_controlId_idx" ON "Assessment"("orgId", "controlId");

-- CreateIndex
CREATE INDEX "NonConformity_orgId_status_idx" ON "NonConformity"("orgId", "status");

-- CreateIndex
CREATE INDEX "Unit_orgId_idx" ON "Unit"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_orgId_name_key" ON "Season"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AgroIndicator_orgId_name_key" ON "AgroIndicator"("orgId", "name");

-- CreateIndex
CREATE INDEX "AgroMeasurement_orgId_indicatorId_refDate_idx" ON "AgroMeasurement"("orgId", "indicatorId", "refDate");

-- CreateIndex
CREATE INDEX "AiUsageLog_orgId_createdAt_idx" ON "AiUsageLog"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Simulation_orgId_projectId_idx" ON "Simulation"("orgId", "projectId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineTask" ADD CONSTRAINT "BaselineTask_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "Baseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessCaseLine" ADD CONSTRAINT "BusinessCaseLine_businessCaseId_fkey" FOREIGN KEY ("businessCaseId") REFERENCES "BusinessCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

