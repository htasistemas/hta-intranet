-- AlterTable
ALTER TABLE "conexoes_google_agenda" ADD COLUMN     "oauthClientId" TEXT,
ADD COLUMN     "oauthClientSecretEncrypted" TEXT,
ADD COLUMN     "redirectUri" TEXT;

-- CreateTable
CREATE TABLE "rascunhos_oauth_google_agenda" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "oauthClientId" TEXT NOT NULL,
    "oauthClientSecretEncrypted" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rascunhos_oauth_google_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rascunhos_oauth_google_agenda_userId_key" ON "rascunhos_oauth_google_agenda"("userId");
