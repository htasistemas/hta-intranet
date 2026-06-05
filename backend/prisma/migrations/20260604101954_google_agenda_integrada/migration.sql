-- AlterTable
ALTER TABLE "compromissos" ADD COLUMN     "googleCalendarId" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "googleSyncStatus" TEXT,
ADD COLUMN     "googleSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "conexoes_google_agenda" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conexoes_google_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conexoes_google_agenda_userId_key" ON "conexoes_google_agenda"("userId");

-- CreateIndex
CREATE INDEX "compromissos_userId_googleEventId_idx" ON "compromissos"("userId", "googleEventId");

-- AddForeignKey
ALTER TABLE "conexoes_google_agenda" ADD CONSTRAINT "conexoes_google_agenda_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
