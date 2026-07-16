-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "partnerId" TEXT;

-- CreateIndex
CREATE INDEX "usuarios_partnerId_idx" ON "usuarios"("partnerId");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "parceiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
