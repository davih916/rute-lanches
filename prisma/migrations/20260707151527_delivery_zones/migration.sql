-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "neighborhood" TEXT NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recebido',
    "deliveryType" TEXT NOT NULL DEFAULT 'entrega',
    "paymentMethod" TEXT NOT NULL,
    "cashChangeForCents" INTEGER,
    "itemsTotalCents" INTEGER NOT NULL,
    "deliveryZoneId" TEXT,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "printedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "delivery_zones" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("cashChangeForCents", "createdAt", "customerId", "deliveryFeeCents", "deliveryType", "id", "itemsTotalCents", "notes", "orderNumber", "paymentMethod", "printedAt", "status", "totalCents", "updatedAt") SELECT "cashChangeForCents", "createdAt", "customerId", "deliveryFeeCents", "deliveryType", "id", "itemsTotalCents", "notes", "orderNumber", "paymentMethod", "printedAt", "status", "totalCents", "updatedAt" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_neighborhood_key" ON "delivery_zones"("neighborhood");
