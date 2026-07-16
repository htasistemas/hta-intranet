-- CreateEnum
CREATE TYPE "CrmDealStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "crm_atividades" ADD COLUMN "dealId" TEXT;

-- AlterTable
ALTER TABLE "crm_propostas" ADD COLUMN "dealId" TEXT;

-- CreateTable
CREATE TABLE "crm_negocios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "product" TEXT,
    "value" DECIMAL(12,2),
    "probability" INTEGER NOT NULL DEFAULT 10,
    "stage" "CrmPipelineStage" NOT NULL DEFAULT 'LEAD_RECEIVED',
    "status" "CrmDealStatus" NOT NULL DEFAULT 'OPEN',
    "responsible" TEXT NOT NULL,
    "expectedCloseAt" TIMESTAMP(3),
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "nextStep" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_negocios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_atividades_dealId_createdAt_idx" ON "crm_atividades"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_negocios_tenantId_ownerId_status_idx" ON "crm_negocios"("tenantId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "crm_negocios_tenantId_ownerId_stage_idx" ON "crm_negocios"("tenantId", "ownerId", "stage");

-- CreateIndex
CREATE INDEX "crm_negocios_tenantId_ownerId_expectedCloseAt_idx" ON "crm_negocios"("tenantId", "ownerId", "expectedCloseAt");

-- CreateIndex
CREATE INDEX "crm_negocios_leadId_idx" ON "crm_negocios"("leadId");

-- CreateIndex
CREATE INDEX "crm_negocios_clientId_idx" ON "crm_negocios"("clientId");

-- CreateIndex
CREATE INDEX "crm_propostas_dealId_idx" ON "crm_propostas"("dealId");

-- AddForeignKey
ALTER TABLE "crm_atividades" ADD CONSTRAINT "crm_atividades_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_negocios" ADD CONSTRAINT "crm_negocios_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_negocios" ADD CONSTRAINT "crm_negocios_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_negocios" ADD CONSTRAINT "crm_negocios_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_propostas" ADD CONSTRAINT "crm_propostas_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "crm_negocios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
