-- AlterTable
ALTER TABLE "fiscal" ADD COLUMN "ambiente" TEXT;
ALTER TABLE "fiscal" ADD COLUMN "chaveAcesso" TEXT;
ALTER TABLE "fiscal" ADD COLUMN "numero" INTEGER;
ALTER TABLE "fiscal" ADD COLUMN "serie" INTEGER;
ALTER TABLE "fiscal" ADD COLUMN "xmlContent" TEXT;

-- CreateTable
CREATE TABLE "fiscal_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "provider" TEXT NOT NULL DEFAULT 'pending',
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "clientId" TEXT,
    "clientSecretEncrypted" TEXT,
    "cnpj" TEXT,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "regimeTributario" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "municipioCodigo" TEXT,
    "municipioNome" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "empresaRegistradaEm" DATETIME,
    "certificadoEnviadoEm" DATETIME,
    "certificadoValidoAte" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ingredients" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "ncm" TEXT,
    "cfop" TEXT,
    "csosnCst" TEXT,
    "unidadeComercial" TEXT NOT NULL DEFAULT 'UN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_products" ("active", "categoryId", "createdAt", "description", "id", "imageUrl", "ingredients", "name", "order", "priceCents", "slug", "updatedAt") SELECT "active", "categoryId", "createdAt", "description", "id", "imageUrl", "ingredients", "name", "order", "priceCents", "slug", "updatedAt" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
