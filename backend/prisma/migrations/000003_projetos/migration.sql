-- Modulo empresarial de projetos.
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

CREATE TABLE "projetos" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "budget" DECIMAL(12,2),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projetos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tarefas" ADD COLUMN "projectId" TEXT;

CREATE UNIQUE INDEX "projetos_code_key" ON "projetos"("code");
CREATE INDEX "projetos_ownerId_status_idx" ON "projetos"("ownerId", "status");
CREATE INDEX "projetos_clientId_idx" ON "projetos"("clientId");

ALTER TABLE "projetos" ADD CONSTRAINT "projetos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
