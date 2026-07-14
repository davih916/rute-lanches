-- Área autenticada para empresas clientes.
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "empresaNome" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "regimeTributario" TEXT NOT NULL,
    "inscricaoEstadual" TEXT,
    "inscricaoMunicipal" TEXT,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "cep" TEXT,
    "codigoIbge" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "plano" TEXT NOT NULL DEFAULT 'Plano Essencial',
    "statusAssinatura" TEXT NOT NULL DEFAULT 'ativa',
    "proximoVencimento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "clientes_usuarios" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deveAlterarSenha" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientes_usuarios_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clientes_cnpj_key" ON "clientes"("cnpj");
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");
CREATE UNIQUE INDEX "clientes_usuarios_email_key" ON "clientes_usuarios"("email");
CREATE INDEX "clientes_usuarios_clienteId_idx" ON "clientes_usuarios"("clienteId");
ALTER TABLE "clientes_usuarios" ADD CONSTRAINT "clientes_usuarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
