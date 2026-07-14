-- O webhook do PagBank consulta pix_charges por externalId a cada notificação.
CREATE INDEX "pix_charges_externalId_idx" ON "pix_charges"("externalId");
