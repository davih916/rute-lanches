-- AlterTable
ALTER TABLE "delivery_zones"
  ADD COLUMN "cepPrefix" TEXT;

CREATE UNIQUE INDEX "delivery_zones_cepPrefix_key" ON "delivery_zones"("cepPrefix");

-- AlterTable
ALTER TABLE "customers"
  ADD COLUMN "cep" TEXT;

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "cep" TEXT;
