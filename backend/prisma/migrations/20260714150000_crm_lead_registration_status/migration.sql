-- CreateEnum
CREATE TYPE "CrmRegistrationStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- AlterTable
ALTER TABLE "crm_leads"
ADD COLUMN "registrationStatus" "CrmRegistrationStatus" NOT NULL DEFAULT 'INCOMPLETE';
