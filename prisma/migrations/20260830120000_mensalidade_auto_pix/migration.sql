-- CreateTable
CREATE TABLE "mensalidade_pagamento_config" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "clientId" TEXT,
  "clientSecretEncrypted" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mensalidade_pagamento_config_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "settings"
  ADD COLUMN "mensalidadeValorCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mensalidadeChargeMonth" TEXT,
  ADD COLUMN "mensalidadeChargeExternalId" TEXT,
  ADD COLUMN "mensalidadeChargeQrCodeText" TEXT;
