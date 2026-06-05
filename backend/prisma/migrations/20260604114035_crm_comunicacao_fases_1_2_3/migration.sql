-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "CommunicationProvider" AS ENUM ('SMTP', 'SENDGRID', 'RESEND', 'META_WHATSAPP', 'ZAPI', 'EVOLUTION', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomerRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "crm_configuracoes_comunicacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "provider" "CommunicationProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "senderName" TEXT,
    "senderAddress" TEXT,
    "endpointUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "apiSecretEncrypted" TEXT,
    "defaultFrom" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_configuracoes_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_templates_comunicacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_templates_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_mensagens_comunicacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "provider" "CommunicationProvider",
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "templateId" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "campaignId" TEXT,
    "recipientName" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_mensagens_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_fila_comunicacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "messageId" TEXT NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_fila_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_campanhas_comunicacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_campanhas_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_scores_clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "clientId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "riskLevel" "CustomerRiskLevel" NOT NULL DEFAULT 'LOW',
    "potentialValue" DECIMAL(12,2),
    "engagementScore" INTEGER NOT NULL DEFAULT 0,
    "recurrenceScore" INTEGER NOT NULL DEFAULT 0,
    "overdueScore" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_scores_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_metas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "responsible" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "targetValue" DECIMAL(12,2),
    "targetCount" INTEGER,
    "achievedValue" DECIMAL(12,2) DEFAULT 0,
    "achievedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_metas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_regras_sla" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "CrmPipelineStage",
    "priority" "Priority",
    "maxHours" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "crm_regras_sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_webhooks_comunicacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "channel" "CommunicationChannel" NOT NULL,
    "provider" "CommunicationProvider",
    "messageId" TEXT,
    "providerMessageId" TEXT,
    "status" "CommunicationStatus",
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_webhooks_comunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_configuracoes_comunicacao_tenantId_ownerId_channel_acti_idx" ON "crm_configuracoes_comunicacao"("tenantId", "ownerId", "channel", "active");

-- CreateIndex
CREATE INDEX "crm_templates_comunicacao_tenantId_ownerId_channel_active_idx" ON "crm_templates_comunicacao"("tenantId", "ownerId", "channel", "active");

-- CreateIndex
CREATE INDEX "crm_mensagens_comunicacao_tenantId_ownerId_status_scheduled_idx" ON "crm_mensagens_comunicacao"("tenantId", "ownerId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "crm_mensagens_comunicacao_clientId_createdAt_idx" ON "crm_mensagens_comunicacao"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_mensagens_comunicacao_leadId_createdAt_idx" ON "crm_mensagens_comunicacao"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_fila_comunicacao_tenantId_status_scheduledAt_idx" ON "crm_fila_comunicacao"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "crm_campanhas_comunicacao_tenantId_ownerId_status_idx" ON "crm_campanhas_comunicacao"("tenantId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "crm_scores_clientes_tenantId_clientId_calculatedAt_idx" ON "crm_scores_clientes"("tenantId", "clientId", "calculatedAt");

-- CreateIndex
CREATE INDEX "crm_metas_tenantId_ownerId_active_idx" ON "crm_metas"("tenantId", "ownerId", "active");

-- CreateIndex
CREATE INDEX "crm_regras_sla_tenantId_ownerId_active_idx" ON "crm_regras_sla"("tenantId", "ownerId", "active");

-- CreateIndex
CREATE INDEX "crm_webhooks_comunicacao_tenantId_providerMessageId_idx" ON "crm_webhooks_comunicacao"("tenantId", "providerMessageId");

-- AddForeignKey
ALTER TABLE "crm_configuracoes_comunicacao" ADD CONSTRAINT "crm_configuracoes_comunicacao_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_templates_comunicacao" ADD CONSTRAINT "crm_templates_comunicacao_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensagens_comunicacao" ADD CONSTRAINT "crm_mensagens_comunicacao_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensagens_comunicacao" ADD CONSTRAINT "crm_mensagens_comunicacao_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "crm_templates_comunicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensagens_comunicacao" ADD CONSTRAINT "crm_mensagens_comunicacao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensagens_comunicacao" ADD CONSTRAINT "crm_mensagens_comunicacao_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensagens_comunicacao" ADD CONSTRAINT "crm_mensagens_comunicacao_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "crm_campanhas_comunicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_fila_comunicacao" ADD CONSTRAINT "crm_fila_comunicacao_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "crm_mensagens_comunicacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campanhas_comunicacao" ADD CONSTRAINT "crm_campanhas_comunicacao_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campanhas_comunicacao" ADD CONSTRAINT "crm_campanhas_comunicacao_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "crm_templates_comunicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scores_clientes" ADD CONSTRAINT "crm_scores_clientes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "crm_clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_metas" ADD CONSTRAINT "crm_metas_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_regras_sla" ADD CONSTRAINT "crm_regras_sla_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_webhooks_comunicacao" ADD CONSTRAINT "crm_webhooks_comunicacao_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "crm_mensagens_comunicacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
