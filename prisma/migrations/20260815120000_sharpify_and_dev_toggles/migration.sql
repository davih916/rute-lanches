-- CreateTable
CREATE TABLE "sharpify_config" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "clientId" TEXT,
  "clientSecretEncrypted" TEXT,
  "testadoEm" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sharpify_config_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "settings"
  ADD COLUMN "mensalidadeReminderEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "pix_charges"
  ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'chave_simples';
