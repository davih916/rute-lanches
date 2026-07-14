-- Status de pagamento (separado do status de preparo) + opt-in de nota fiscal.
ALTER TABLE "orders" ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pendente',
ADD COLUMN     "wantsInvoice" BOOLEAN NOT NULL DEFAULT false;

-- Configuração da integração PagBank (singleton).
CREATE TABLE "pagbank_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "clientId" TEXT,
    "clientSecretEncrypted" TEXT,
    "tokenEncrypted" TEXT,
    "ambiente" TEXT NOT NULL DEFAULT 'sandbox',
    "testadoEm" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pagbank_config_pkey" PRIMARY KEY ("id")
);

-- Cobrança PIX por pedido.
CREATE TABLE "pix_charges" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    "qrCodeText" TEXT,
    "qrCodeImageUrl" TEXT,
    "amountCents" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pix_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pix_charges_orderId_key" ON "pix_charges"("orderId");
ALTER TABLE "pix_charges" ADD CONSTRAINT "pix_charges_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
