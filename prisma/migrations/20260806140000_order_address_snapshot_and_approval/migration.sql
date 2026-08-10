-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "addressNumber" TEXT,
  ADD COLUMN "neighborhood" TEXT,
  ADD COLUMN "complement" TEXT,
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "notifiedStatuses" TEXT NOT NULL DEFAULT '[]';

-- Preenche o snapshot dos pedidos já existentes a partir do cadastro atual
-- do cliente e/ou do bairro pré-cadastrado vinculado, pra não deixar pedidos
-- antigos sem endereço na comanda/reimpressão.
UPDATE "orders" o
SET
  "address" = c."address",
  "addressNumber" = c."addressNumber",
  "neighborhood" = COALESCE(dz."neighborhood", c."neighborhood"),
  "complement" = c."complement",
  "reference" = c."reference"
FROM "customers" c
LEFT JOIN "delivery_zones" dz ON dz."id" = o."deliveryZoneId"
WHERE o."customerId" = c."id";
