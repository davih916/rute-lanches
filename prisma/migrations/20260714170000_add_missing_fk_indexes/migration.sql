-- Postgres não cria índice automático em chave estrangeira (diferente do
-- MySQL) — adiciona os que faltavam para os relacionamentos mais consultados.
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
CREATE INDEX "orders_deliveryZoneId_idx" ON "orders"("deliveryZoneId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
