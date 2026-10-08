CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELED');

ALTER TABLE "parceiros_projetos"
  ADD COLUMN "commissionAmount" DECIMAL(12,2),
  ADD COLUMN "commissionStatus" "PartnerCommissionStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3);
