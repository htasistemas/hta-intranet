-- AlterEnum
ALTER TYPE "CrmRegistrationStatus" ADD VALUE 'UPDATING';

-- AlterTable
ALTER TABLE "crm_leads"
ADD COLUMN "registrationStatusManual" BOOLEAN NOT NULL DEFAULT false;
