ALTER TABLE "crm_mensagens_comunicacao"
ADD COLUMN "trackingToken" TEXT,
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "firstOpenedAt" TIMESTAMP(3),
ADD COLUMN "lastOpenedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "crm_mensagens_comunicacao_trackingToken_key"
ON "crm_mensagens_comunicacao"("trackingToken");
