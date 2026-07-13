CREATE TYPE "PartnerType" AS ENUM ('REFERRAL', 'RESELLER', 'IMPLEMENTATION', 'STRATEGIC', 'AFFILIATE');

CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECTING', 'SUSPENDED');

CREATE TYPE "CommissionModel" AS ENUM ('ONE_TIME', 'RECURRING', 'REVENUE_SHARE', 'PROJECT_BASED', 'HYBRID');

CREATE TYPE "PartnerInteractionType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'NOTE', 'TRAINING', 'PROPOSAL', 'REVIEW');

CREATE TABLE "parceiros" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "company" TEXT,
  "document" TEXT,
  "type" "PartnerType" NOT NULL DEFAULT 'REFERRAL',
  "status" "PartnerStatus" NOT NULL DEFAULT 'PROSPECTING',
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "website" TEXT,
  "city" TEXT,
  "state" TEXT,
  "segment" TEXT,
  "commissionModel" "CommissionModel" NOT NULL DEFAULT 'ONE_TIME',
  "commissionPercent" DECIMAL(8,2),
  "recurringMonths" INTEGER,
  "fixedAmount" DECIMAL(12,2),
  "closeBonus" DECIMAL(12,2),
  "paymentTrigger" TEXT,
  "contractStart" TIMESTAMP(3),
  "contractEnd" TIMESTAMP(3),
  "goals" TEXT,
  "strengths" TEXT,
  "rules" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parceiros_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parceiros_projetos" (
  "partnerId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "parceiros_projetos_pkey" PRIMARY KEY ("partnerId","projectId")
);

CREATE TABLE "parceiros_interacoes" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" "PartnerInteractionType" NOT NULL DEFAULT 'NOTE',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextStep" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "parceiros_interacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parceiros_ownerId_status_idx" ON "parceiros"("ownerId", "status");
CREATE INDEX "parceiros_ownerId_name_idx" ON "parceiros"("ownerId", "name");
CREATE INDEX "parceiros_interacoes_partnerId_occurredAt_idx" ON "parceiros_interacoes"("partnerId", "occurredAt");
CREATE INDEX "parceiros_interacoes_ownerId_occurredAt_idx" ON "parceiros_interacoes"("ownerId", "occurredAt");

ALTER TABLE "parceiros" ADD CONSTRAINT "parceiros_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parceiros_projetos" ADD CONSTRAINT "parceiros_projetos_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "parceiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parceiros_projetos" ADD CONSTRAINT "parceiros_projetos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parceiros_interacoes" ADD CONSTRAINT "parceiros_interacoes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "parceiros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parceiros_interacoes" ADD CONSTRAINT "parceiros_interacoes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
