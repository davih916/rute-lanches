-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "addressNumber" TEXT,
    "neighborhood" TEXT,
    "complement" TEXT,
    "reference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_customers" ("address", "addressNumber", "complement", "createdAt", "id", "name", "neighborhood", "phone", "reference", "updatedAt") SELECT "address", "addressNumber", "complement", "createdAt", "id", "name", "neighborhood", "phone", "reference", "updatedAt" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" INTEGER NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recebido',
    "deliveryType" TEXT NOT NULL DEFAULT 'entrega',
    "paymentMethod" TEXT NOT NULL,
    "cashChangeForCents" INTEGER,
    "itemsTotalCents" INTEGER NOT NULL,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "printedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("createdAt", "customerId", "deliveryFeeCents", "id", "itemsTotalCents", "notes", "orderNumber", "paymentMethod", "printedAt", "status", "totalCents", "updatedAt") SELECT "createdAt", "customerId", "deliveryFeeCents", "id", "itemsTotalCents", "notes", "orderNumber", "paymentMethod", "printedAt", "status", "totalCents", "updatedAt" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
