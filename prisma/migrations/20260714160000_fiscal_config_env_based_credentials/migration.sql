-- Provider/ambiente/credenciais da Nuvem Fiscal e o certificado A1 passam a
-- vir de variáveis de ambiente + arquivo local no servidor, não mais do
-- painel admin (tela "Fiscal" removida). Ver HANDOFF.md.
ALTER TABLE "fiscal_config" DROP COLUMN "provider",
DROP COLUMN "ambiente",
DROP COLUMN "clientId",
DROP COLUMN "clientSecretEncrypted";
