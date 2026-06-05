-- CreateTable
CREATE TABLE "clientes_projetos" (
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_projetos_pkey" PRIMARY KEY ("clientId","projectId")
);

-- AddForeignKey
ALTER TABLE "clientes_projetos" ADD CONSTRAINT "clientes_projetos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_projetos" ADD CONSTRAINT "clientes_projetos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projetos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
