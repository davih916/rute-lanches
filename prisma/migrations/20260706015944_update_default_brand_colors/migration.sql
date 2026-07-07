-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'Rute Lanches',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#F97316',
    "secondaryColor" TEXT NOT NULL DEFAULT '#16A34A',
    "whatsapp" TEXT,
    "address" TEXT,
    "storeOpen" BOOLEAN NOT NULL DEFAULT true,
    "openingHours" TEXT NOT NULL DEFAULT '{}',
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "receiptWidth" TEXT NOT NULL DEFAULT '80mm',
    "lastOrderNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_settings" ("address", "deliveryFeeCents", "id", "lastOrderNumber", "logoUrl", "minOrderCents", "openingHours", "primaryColor", "receiptWidth", "secondaryColor", "storeName", "storeOpen", "updatedAt", "whatsapp") SELECT "address", "deliveryFeeCents", "id", "lastOrderNumber", "logoUrl", "minOrderCents", "openingHours", "primaryColor", "receiptWidth", "secondaryColor", "storeName", "storeOpen", "updatedAt", "whatsapp" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
