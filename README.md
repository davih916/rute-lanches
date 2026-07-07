# Rute Lanches

Sistema de cardápio digital + painel administrativo para lanchonete, construído para ser a
fundação de um produto replicável (multi-cliente no futuro).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma + SQLite (dev) — troca para Postgres/MySQL trocando `provider` e `DATABASE_URL`
- Zustand (carrinho), TanStack Query (polling do painel)
- Autenticação do admin: JWT em cookie httpOnly (bcrypt + `jose`), validada no `proxy.ts`

## Primeiros passos

```bash
npm install
cp .env.example .env        # ajuste JWT_SECRET antes de ir para produção
npm run prisma:migrate       # cria o banco SQLite e aplica as migrations
npm run prisma:seed          # categorias/produtos da Rute Lanches + admin inicial
npm run dev
```

Site do cliente: http://localhost:3000
Painel admin: http://localhost:3000/admin/login (link discreto "Admin" no rodapé do site)

As credenciais do admin criado pelo seed aparecem no terminal ao rodar `prisma:seed`
(por padrão `admin@rutelanches.com.br` / senha definida em `SEED_ADMIN_PASSWORD`). Troque a
senha assim que possível.

## Fluxo principal (o que já funciona)

Cliente monta pedido → pedido cai no painel → funcionário aceita ("Preparando", dispara
impressão automática da comanda) → segue os status até "Entregue"/"Cancelado".

- **Site**: cardápio por categoria, adicionais, observações, carrinho, checkout, confirmação
  do pedido em `/pedido/[id]`.
- **Painel**: Kanban de pedidos com atualização por polling (5s) e alerta sonoro para pedidos
  novos, impressão de comanda (58mm/80mm, `/admin/comanda/[id]`), configurações da loja
  (nome, cores, aberto/fechado, taxa de entrega, largura da bobina).
- **Fiscal**: emissão real de NFC-e via Nuvem Fiscal (`src/lib/fiscal/providers/nuvem-fiscal-provider.ts`).
  Configure em `/admin/fiscal`: provider, ambiente, dados da empresa e certificado A1 (.pfx).
  Cada produto precisa de NCM/CFOP/CSOSN-CST preenchidos em `/admin/produtos` antes de emitir.
  A emissão nunca é automática — o botão "Emitir NFC-e" aparece no card do pedido quando ele
  está "Entregue". **Teste sempre em homologação antes de ligar produção**, e revise os códigos
  fiscais (CSOSN/CST, PIS/COFINS) com o contador da empresa — são simplificações razoáveis para
  Simples Nacional, não uma consultoria tributária.

Ainda não implementado (próximas etapas): CRUD de produtos/categorias no painel, relatórios.

## Scripts úteis

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm run start` | build e servidor de produção |
| `npm run prisma:studio` | abre o Prisma Studio (editar dados manualmente) |
| `npm run prisma:migrate` | cria uma nova migration a partir do `schema.prisma` |

## Estrutura

```
prisma/            schema.prisma, migrations, seed.ts
src/proxy.ts        protege /admin/* (equivalente ao antigo middleware.ts no Next 16)
src/lib/            prisma client, auth, validações Zod, services (order/settings), fiscal/
src/store/          cart-store (Zustand)
src/components/     ui/ (reutilizáveis), site/, admin/, print/
src/app/(site)/     páginas públicas
src/app/admin/      login, dashboard, produtos, categorias, configurações, comanda
```
