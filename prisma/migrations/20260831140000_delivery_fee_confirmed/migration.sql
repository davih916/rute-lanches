-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "deliveryFeeConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: pedidos existentes com taxa > 0 já tiveram a taxa confirmada de
-- fato (não tem como saber ao certo, mas taxa > 0 é o sinal mais forte de
-- que foi digitada de propósito, não deixada no valor padrão por engano).
UPDATE "orders" SET "deliveryFeeConfirmed" = true WHERE "deliveryFeeCents" > 0;
