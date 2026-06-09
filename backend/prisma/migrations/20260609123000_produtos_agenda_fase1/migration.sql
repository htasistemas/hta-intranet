CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'SERVICE', 'SUBSCRIPTION', 'LICENSE', 'PROJECT');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ClientProductStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "produtos_servicos" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ProductType" NOT NULL DEFAULT 'SERVICE',
  "category" TEXT,
  "commercialDescription" TEXT,
  "technicalDescription" TEXT,
  "unit" TEXT,
  "price" DECIMAL(12,2),
  "cost" DECIMAL(12,2),
  "margin" DECIMAL(8,2),
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "sla" TEXT,
  "deliveryTime" TEXT,
  "technicalOwner" TEXT,
  "fiscalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "produtos_servicos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clientes_produtos" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3),
  "renewalDate" TIMESTAMP(3),
  "contractedValue" DECIMAL(12,2),
  "status" "ClientProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "responsible" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clientes_produtos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "compromissos"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'FOLLOW_UP';

ALTER TABLE "projetos"
  ADD COLUMN "productId" TEXT;

CREATE UNIQUE INDEX "produtos_servicos_ownerId_code_key" ON "produtos_servicos"("ownerId", "code");
CREATE INDEX "produtos_servicos_ownerId_status_idx" ON "produtos_servicos"("ownerId", "status");
CREATE INDEX "produtos_servicos_ownerId_name_idx" ON "produtos_servicos"("ownerId", "name");
CREATE INDEX "clientes_produtos_ownerId_status_idx" ON "clientes_produtos"("ownerId", "status");
CREATE INDEX "clientes_produtos_clientId_idx" ON "clientes_produtos"("clientId");
CREATE INDEX "clientes_produtos_productId_idx" ON "clientes_produtos"("productId");
CREATE INDEX "compromissos_projectId_idx" ON "compromissos"("projectId");

ALTER TABLE "produtos_servicos" ADD CONSTRAINT "produtos_servicos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clientes_produtos" ADD CONSTRAINT "clientes_produtos_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clientes_produtos" ADD CONSTRAINT "clientes_produtos_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clientes_produtos" ADD CONSTRAINT "clientes_produtos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produtos_servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compromissos" ADD CONSTRAINT "compromissos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projetos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projetos" ADD CONSTRAINT "projetos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "produtos_servicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
