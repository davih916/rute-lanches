# Certificado digital A1

Esta pasta é onde o certificado A1 (`.pfx`/`.p12`) deve ser colocado no
servidor, **fora do Git** (o `.gitignore` já bloqueia qualquer arquivo aqui
dentro, exceto este README).

## Instalação (feita manualmente na implantação do cliente)

1. Copie o arquivo `.pfx`/`.p12` para dentro desta pasta, por exemplo:
   `certs/certificado.pfx`
2. No `.env` do servidor, defina:
   ```
   FISCAL_CERTIFICADO_PATH="./certs/certificado.pfx"
   FISCAL_CERTIFICADO_SENHA="a senha real do certificado"
   ```
3. Restrinja a permissão do arquivo para leitura só pelo usuário que roda a
   aplicação, por exemplo: `chmod 600 certs/certificado.pfx`.
4. Reinicie a aplicação. Na inicialização, o sistema:
   - valida se o arquivo existe, se a senha está correta e se o certificado
     não está vencido (loga um erro amigável se algo estiver errado);
   - se estiver tudo certo, registra a empresa e envia o certificado para o
     provider fiscal (Nuvem Fiscal) automaticamente — sem nenhuma ação manual
     no painel admin.

Se o certificado vencer ou for substituído, basta trocar o arquivo (mesmo
caminho) e reiniciar a aplicação — ela reenvia sozinha.
