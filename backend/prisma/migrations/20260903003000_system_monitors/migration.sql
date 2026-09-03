CREATE TYPE "SystemMonitorStatus" AS ENUM ('UNKNOWN', 'ACTIVE', 'DOWN');

CREATE TABLE "sistemas_monitorados" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "checkPath" TEXT NOT NULL DEFAULT '/',
    "expectedStatus" INTEGER NOT NULL DEFAULT 200,
    "timeoutMs" INTEGER NOT NULL DEFAULT 8000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" "SystemMonitorStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "responseTimeMs" INTEGER,
    "lastError" TEXT,
    "lastOnlineAt" TIMESTAMP(3),
    "lastOfflineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sistemas_monitorados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sistemas_monitorados_ownerId_url_key" ON "sistemas_monitorados"("ownerId", "url");
CREATE INDEX "sistemas_monitorados_ownerId_active_idx" ON "sistemas_monitorados"("ownerId", "active");
CREATE INDEX "sistemas_monitorados_ownerId_status_idx" ON "sistemas_monitorados"("ownerId", "status");

ALTER TABLE "sistemas_monitorados" ADD CONSTRAINT "sistemas_monitorados_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
