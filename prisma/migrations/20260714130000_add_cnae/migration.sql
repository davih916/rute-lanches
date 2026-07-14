-- Atividade econômica principal (CNAE) no cadastro fiscal e no portal de clientes.
ALTER TABLE "fiscal_config" ADD COLUMN     "cnaePrincipal" TEXT,
ADD COLUMN     "cnaeDescricao" TEXT;

ALTER TABLE "clientes" ADD COLUMN     "cnaePrincipal" TEXT,
ADD COLUMN     "cnaeDescricao" TEXT;
