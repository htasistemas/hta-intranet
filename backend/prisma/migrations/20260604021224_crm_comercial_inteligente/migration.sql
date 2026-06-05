-- CreateEnum
CREATE TYPE "CrmLeadScore" AS ENUM ('VERY_HOT', 'HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'IN_SERVICE', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "CrmPipelineStage" AS ENUM ('LEAD_RECEIVED', 'FIRST_CONTACT', 'QUALIFICATION', 'DEMONSTRATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'APPROVAL', 'IMPLEMENTATION', 'SALE_COMPLETED', 'LOST');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'STATUS_CHANGE', 'PROPOSAL', 'CONTRACT', 'TASK', 'NOTE', 'VISIT', 'DEMONSTRATION', 'FOLLOW_UP', 'IMPLEMENTATION', 'TRAINING');

-- CreateEnum
CREATE TYPE "CrmActivityStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmProposalStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CrmContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmProjectStatus" AS ENUM ('NOT_STARTED', 'PLANNING', 'IN_DEVELOPMENT', 'IN_TESTS', 'IN_APPROVAL', 'IN_DEPLOYMENT', 'IN_TRAINING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmAutomationTrigger" AS ENUM ('LEAD_CREATED', 'PROPOSAL_SENT', 'SALE_COMPLETED', 'PROJECT_COMPLETED', 'LEAD_IDLE');

-- CreateEnum
CREATE TYPE "CrmAutomationAction" AS ENUM ('CREATE_TASK', 'CREATE_FOLLOW_UP', 'CREATE_PROJECT', 'REQUEST_SURVEY', 'CREATE_ALERT');

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "document" TEXT,
    "segment" TEXT,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "site" TEXT,
    "postalCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "source" TEXT,
    "campaign" TEXT,
    "responsible" TEXT NOT NULL,
    "interest" TEXT,
    "productInterest" TEXT,
    "estimatedValue" DECIMAL(12,2),
    "observations" TEXT,
    "score" "CrmLeadScore" NOT NULL DEFAULT 'WARM',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
    "stage" "CrmPipelineStage" NOT NULL DEFAULT 'LEAD_RECEIVED',
    "lostReason" TEXT,
    "lastInteractionAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "document" TEXT,
    "segment" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "postalCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_atividades" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "type" "CrmActivityType" NOT NULL,
    "status" "CrmActivityStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_propostas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "number" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "deadline" TEXT,
    "observations" TEXT,
    "status" "CrmProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "versionHistory" JSONB NOT NULL DEFAULT '[]',
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_propostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contratos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "proposalId" TEXT,
    "number" TEXT NOT NULL,
    "serviceOrder" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "status" "CrmContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_projetos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "team" JSONB NOT NULL DEFAULT '[]',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CrmProjectStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(12,2),
    "plannedHours" DECIMAL(10,2),
    "executedHours" DECIMAL(10,2) DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tarefas_projetos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "projectId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsible" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "plannedHours" DECIMAL(10,2),
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "comments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_tarefas_projetos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_automacoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "CrmAutomationTrigger" NOT NULL,
    "action" "CrmAutomationAction" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_automacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_leads_tenantId_ownerId_status_idx" ON "crm_leads"("tenantId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "crm_leads_tenantId_ownerId_stage_idx" ON "crm_leads"("tenantId", "ownerId", "stage");

-- CreateIndex
CREATE INDEX "crm_leads_tenantId_ownerId_createdAt_idx" ON "crm_leads"("tenantId", "ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_clientes_tenantId_ownerId_name_idx" ON "crm_clientes"("tenantId", "ownerId", "name");

-- CreateIndex
CREATE INDEX "crm_atividades_tenantId_ownerId_scheduledAt_idx" ON "crm_atividades"("tenantId", "ownerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "crm_atividades_leadId_createdAt_idx" ON "crm_atividades"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_atividades_clientId_createdAt_idx" ON "crm_atividades"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_propostas_tenantId_ownerId_status_idx" ON "crm_propostas"("tenantId", "ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_propostas_tenantId_number_key" ON "crm_propostas"("tenantId", "number");

-- CreateIndex
CREATE INDEX "crm_contratos_tenantId_ownerId_status_idx" ON "crm_contratos"("tenantId", "ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contratos_tenantId_number_key" ON "crm_contratos"("tenantId", "number");

-- CreateIndex
CREATE INDEX "crm_projetos_tenantId_ownerId_status_idx" ON "crm_projetos"("tenantId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "crm_projetos_clientId_idx" ON "crm_projetos"("clientId");

-- CreateIndex
CREATE INDEX "crm_tarefas_projetos_tenantId_projectId_status_idx" ON "crm_tarefas_projetos"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "crm_automacoes_tenantId_ownerId_active_idx" ON "crm_automacoes"("tenantId", "ownerId", "active");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_clientes" ADD CONSTRAINT "crm_clientes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "crm_projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_propostas" ADD CONSTRAINT "crm_propostas_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_propostas" ADD CONSTRAINT "crm_propostas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_propostas" ADD CONSTRAINT "crm_propostas_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contratos" ADD CONSTRAINT "crm_contratos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contratos" ADD CONSTRAINT "crm_contratos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_projetos" ADD CONSTRAINT "crm_projetos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_projetos" ADD CONSTRAINT "crm_projetos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tarefas_projetos" ADD CONSTRAINT "crm_tarefas_projetos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "crm_projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tarefas_projetos" ADD CONSTRAINT "crm_tarefas_projetos_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "crm_tarefas_projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_automacoes" ADD CONSTRAINT "crm_automacoes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
