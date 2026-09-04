CREATE TYPE "SupportTicketStatus" AS ENUM ('NEW', 'TRIAGE', 'IN_PROGRESS', 'WAITING_USER', 'DEVELOPMENT', 'TESTING', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');
CREATE TYPE "SupportTicketImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SupportTicketUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SupportTicketType" AS ENUM ('INCIDENT', 'REQUEST', 'IMPROVEMENT', 'BUG', 'QUESTION', 'DEVELOPMENT');
CREATE TYPE "SupportTicketMessageKind" AS ENUM ('MESSAGE', 'INTERNAL_NOTE', 'STATUS_CHANGE', 'ATTACHMENT', 'AUTOMATIC');

CREATE TABLE "chamados_tecnicos" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "ownerId" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "clientId" TEXT,
  "productId" TEXT,
  "requesterId" TEXT NOT NULL,
  "analystId" TEXT,
  "requesterName" TEXT NOT NULL,
  "requesterEmail" TEXT NOT NULL,
  "requesterPhone" TEXT,
  "unit" TEXT,
  "systemModule" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" "SupportTicketType" NOT NULL,
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "impact" "SupportTicketImpact" NOT NULL DEFAULT 'MEDIUM',
  "urgency" "SupportTicketUrgency" NOT NULL DEFAULT 'MEDIUM',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "currentActivity" TEXT,
  "happened" TEXT,
  "expectedResult" TEXT,
  "actualResult" TEXT,
  "reproductionSteps" TEXT,
  "solution" TEXT,
  "resolutionNote" TEXT,
  "firstResponseAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "reopenedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chamados_tecnicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chamados_mensagens" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "kind" "SupportTicketMessageKind" NOT NULL DEFAULT 'MESSAGE',
  "body" TEXT NOT NULL,
  "status" "SupportTicketStatus" NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamados_mensagens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chamados_anexos" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "messageId" TEXT,
  "uploaderId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "previewable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamados_anexos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chamados_historico" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromValue" TEXT,
  "toValue" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamados_historico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chamados_regras_sla" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" "Priority",
  "category" TEXT,
  "clientId" TEXT,
  "productId" TEXT,
  "type" "SupportTicketType",
  "responseMinutes" INTEGER NOT NULL,
  "resolutionMinutes" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "chamados_regras_sla_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "base_conhecimento" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "systemModule" TEXT,
  "productName" TEXT,
  "content" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "base_conhecimento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chamados_tecnicos_protocol_key" ON "chamados_tecnicos"("protocol");
CREATE INDEX "chamados_tecnicos_tenantId_ownerId_status_createdAt_idx" ON "chamados_tecnicos"("tenantId", "ownerId", "status", "createdAt");
CREATE INDEX "chamados_tecnicos_requesterId_status_idx" ON "chamados_tecnicos"("requesterId", "status");
CREATE INDEX "chamados_tecnicos_analystId_status_idx" ON "chamados_tecnicos"("analystId", "status");
CREATE INDEX "chamados_tecnicos_clientId_status_idx" ON "chamados_tecnicos"("clientId", "status");
CREATE INDEX "chamados_tecnicos_productId_status_idx" ON "chamados_tecnicos"("productId", "status");
CREATE INDEX "chamados_tecnicos_priority_status_idx" ON "chamados_tecnicos"("priority", "status");
CREATE INDEX "chamados_mensagens_ticketId_createdAt_idx" ON "chamados_mensagens"("ticketId", "createdAt");
CREATE INDEX "chamados_mensagens_authorId_createdAt_idx" ON "chamados_mensagens"("authorId", "createdAt");
CREATE INDEX "chamados_anexos_ticketId_createdAt_idx" ON "chamados_anexos"("ticketId", "createdAt");
CREATE INDEX "chamados_anexos_messageId_idx" ON "chamados_anexos"("messageId");
CREATE INDEX "chamados_historico_ticketId_createdAt_idx" ON "chamados_historico"("ticketId", "createdAt");
CREATE INDEX "chamados_historico_userId_createdAt_idx" ON "chamados_historico"("userId", "createdAt");
CREATE INDEX "chamados_regras_sla_ownerId_active_idx" ON "chamados_regras_sla"("ownerId", "active");
CREATE INDEX "chamados_regras_sla_priority_category_idx" ON "chamados_regras_sla"("priority", "category");
CREATE INDEX "base_conhecimento_ownerId_published_idx" ON "base_conhecimento"("ownerId", "published");
CREATE INDEX "base_conhecimento_category_idx" ON "base_conhecimento"("category");

ALTER TABLE "chamados_tecnicos" ADD CONSTRAINT "chamados_tecnicos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chamados_tecnicos" ADD CONSTRAINT "chamados_tecnicos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produtos_servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chamados_tecnicos" ADD CONSTRAINT "chamados_tecnicos_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_tecnicos" ADD CONSTRAINT "chamados_tecnicos_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chamados_mensagens" ADD CONSTRAINT "chamados_mensagens_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "chamados_tecnicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_mensagens" ADD CONSTRAINT "chamados_mensagens_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_anexos" ADD CONSTRAINT "chamados_anexos_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "chamados_tecnicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_anexos" ADD CONSTRAINT "chamados_anexos_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "chamados_mensagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_anexos" ADD CONSTRAINT "chamados_anexos_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_historico" ADD CONSTRAINT "chamados_historico_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "chamados_tecnicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_historico" ADD CONSTRAINT "chamados_historico_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_regras_sla" ADD CONSTRAINT "chamados_regras_sla_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chamados_regras_sla" ADD CONSTRAINT "chamados_regras_sla_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produtos_servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "base_conhecimento" ADD CONSTRAINT "base_conhecimento_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
