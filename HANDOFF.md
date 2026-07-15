# Rute Lanches — Documentação de handoff

> Documento de referência para continuar o desenvolvimento em outra conversa/sessão.
> Reflete o estado do projeto em **2026-07-09** (última atualização: correção do deploy em
> produção na Vercel — troca de SQLite para PostgreSQL, migrations regeradas, error
> boundaries e fallbacks seguros nas páginas públicas — ver §15. Antes disso: CRUD de
> produtos e categorias + upload de foto de produto + troca de senha do admin + controle
> operacional da loja — horário de funcionamento + formas de pagamento aceitas + taxa de
> entrega por bairro). Sempre confira o código-fonte antes de assumir que algo aqui ainda é verdade — este arquivo pode ficar
> desatualizado.

---

## 1. Visão geral

Sistema de cardápio digital + painel administrativo para a lanchonete **Rute Lanches**,
construído para também servir de base replicável (outros clientes no futuro, trocando só
dados de configuração — nunca texto fixo no código).

Fluxo principal já funcionando ponta a ponta:

```
Cliente monta pedido no site
        ↓
Pedido salvo no banco (nº sequencial, status "recebido")
        ↓
Aparece no Kanban do admin (alerta sonoro repetindo até "reconhecer")
        ↓
Funcionário clica "Aceitar pedido" → status "preparando"
        ↓
Comanda de cozinha imprime automaticamente (fonte grande, só o essencial)
        ↓
Segue: "Saiu para entrega" → "Entregue" (ou "Cancelado" a qualquer momento)
        ↓
Admin pode emitir NFC-e manualmente no pedido entregue (Nuvem Fiscal)
```

---

## 2. Stack

| Camada | Tecnologia | Versão (na época) |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.2.10 |
| Linguagem | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Estilo | Tailwind CSS (CSS-first, `@theme`) | ^4 |
| Banco / ORM | PostgreSQL via Prisma (trocado de SQLite em 2026-07-09, ver §4) | Prisma ^6.19.3 |
| Estado do carrinho | Zustand (persistido em localStorage) | ^5 |
| Data fetching do painel | TanStack Query (polling 5s) | ^5 |
| Auth | Cookie JWT httpOnly (`jose`) + bcrypt (`bcryptjs`) | jose ^6, bcryptjs ^3 |
| Validação | Zod em todas as fronteiras (API routes) | ^4 |
| Fiscal | Adapter próprio para Nuvem Fiscal (REST + OAuth2) | — |

**Por que essas escolhas / desvios do "padrão":**
- **PostgreSQL** (era SQLite até 2026-07-09): o deploy na Vercel quebrava com "A server
  error occurred" em qualquer página — causa raiz era `DATABASE_URL="file:./dev.db"`, que
  não funciona em runtime serverless (sistema de arquivos read-only/efêmero, sem
  persistência entre invocações). Nenhum código de aplicação dependia de SQLite
  especificamente (nada de `$queryRaw`/`PRAGMA`), então a troca de `provider` no
  `schema.prisma` foi limpa. **As 6 migrations antigas (sintaxe SQLite) foram substituídas
  por uma única migration nova (`20260707160000_init_postgresql`)** gerada via `prisma
  migrate diff --from-empty --to-schema-datamodel` — histórico de migrations reiniciado de
  propósito porque o banco de produção nunca tinha sido usado (nenhum dado a preservar).
  Preços continuam em **centavos (Int)** — não é mais uma limitação do driver (Postgres tem
  `Decimal`), mas evita bugs de ponto flutuante de qualquer forma, e trocar exigiria migrar
  todos os valores já gravados.
- **Status como `String`, não enum nativo do banco**: portabilidade entre SQLite/Postgres/
  MySQL. Os valores válidos vivem em `src/lib/constants.ts` (`as const` + `Record<...>`) e
  são validados via Zod nas API routes — nunca confie só no tipo do Prisma.
- **`src/proxy.ts` em vez de `middleware.ts`**: o Next 16 renomeou (deprecou) a convenção
  `middleware` para `proxy` (mesmo runtime Node.js por padrão agora). Migração feita com o
  codemod oficial `middleware-to-proxy`. Só ele protege as **páginas** `/admin/*`; cada API
  route sob `/api` faz sua própria checagem de sessão via `getSession()` porque algumas
  (ex: `POST /api/orders`) são públicas por design.
- **Sem WebSocket/Socket.io**: o Kanban usa polling de 5s via TanStack Query. Decisão
  consciente de simplificação (menos infra para deployar); documentado como possível
  upgrade futuro, não como limitação escondida.
- **Sem fila/job assíncrono para NFC-e**: emissão é síncrona dentro do próprio request da
  API route. Aceitável porque NFC-e é processada em tempo real pela SEFAZ (diferente de
  NF-e, que pode ser assíncrona/lote).

---

## 3. Estrutura de pastas

```
prisma/
  schema.prisma          — todos os models
  seed.ts                 — cardápio real + admin + settings (idempotente-ish, ver §9)
  migrations/             — 4 migrations até agora (ver §4)
prisma.config.ts          — config do Prisma 6 (evita warning de package.json#prisma)

src/
  proxy.ts                 — protege páginas /admin/* (substitui middleware.ts no Next 16)

  app/
    layout.tsx             — layout raiz, injeta cores da marca via <style> inline (Settings)
    globals.css            — Tailwind 4 + tokens de marca + CSS de impressão (@media print)
    robots.ts               — disallow /admin
    (site)/                 — grupo de rotas público
      layout.tsx            — header/footer/cart drawer, busca Settings
      page.tsx               — cardápio (Server Component, lê Category+Product do Prisma)
      checkout/page.tsx
      pedido/[id]/page.tsx   — confirmação/acompanhamento (usa cuid, não orderNumber, na URL)
    admin/
      login/page.tsx         — só campo de senha (ver §7)
      (protected)/layout.tsx — sidebar, valida sessão (defensivo; proxy já protege)
        dashboard/page.tsx   — Kanban + stats do dia
        produtos/page.tsx    — CRUD completo (nome, categoria, preço, foto, descrição,
                               ingredientes, adicionais, ativo/inativo) + tabela de campos
                               fiscais logo abaixo (ProductFiscalTable, inalterada)
        categorias/page.tsx  — CRUD (criar, renomear, ativar/desativar, excluir se vazia)
        configuracoes/page.tsx — nome, cores, aberto/fechado, taxa entrega, largura bobina
        fiscal/page.tsx       — config da empresa + certificado A1 + ambiente
      comanda/[id]/page.tsx   — comanda de impressão (fora do layout com sidebar)
    api/
      auth/login, auth/logout, auth/change-password — POST (admin, troca a própria senha)
      orders/                — POST (público), GET (admin)
      orders/[id]/status      — PATCH (admin)
      orders/[id]/print       — POST (admin, marca impresso)
      orders/[id]/fiscal/issue — POST (admin, emite NFC-e)
      orders/[id]/fiscal/pdf   — GET (admin, proxy autenticado do DANFCE)
      products/                — POST (admin, cria produto + adicionais)
      products/[id]             — PATCH (admin, edita produto + substitui adicionais), DELETE
                                   (admin, só se nunca usado em pedido — RESTRICT na FK)
      products/[id]/fiscal     — PATCH (admin, edita NCM/CFOP/CSOSN/unidade)
      products/upload-image     — POST multipart (admin, salva foto em public/uploads/products,
                                   retorna a URL pública)
      categories/               — POST (admin, cria categoria)
      categories/[id]            — PATCH (admin, renomeia/ativa-desativa; aceita `order`
                                   também, mas ainda não há UI de reordenação), DELETE
                                   (admin, só se não tiver produtos — RESTRICT na FK)
      delivery-zones/            — POST (admin, cria bairro)
      delivery-zones/[id]         — PATCH (admin, renomeia/muda taxa/ativa-desativa), DELETE
                                   (admin, só se não tiver pedidos — RESTRICT na FK)
      settings/                — PATCH (admin)
      admin/fiscal/config       — GET/PUT (config fiscal)
      admin/fiscal/certificado  — POST multipart (upload .pfx + senha)
      admin/fiscal/registrar-empresa — POST (cadastra empresa no provider)

  components/
    ui/          — Button, Input, Textarea, Select, Modal, Badge (reutilizáveis, sem lógica de negócio)
    site/        — header, footer, category-nav, product-card/modal, cart-drawer, menu-browser, checkout-form
    admin/       — sidebar, kanban-board, order-card, fiscal-action, fiscal-config-form,
                   fiscal-certificate-card, product-fiscal-table, product-manager (CRUD de
                   produtos + adicionais), category-manager (CRUD de categorias),
                   delivery-zone-manager (CRUD de bairros/taxa, dentro de /admin/configuracoes),
                   settings-form, change-password-form (seção Segurança em /admin/configuracoes),
                   today-stats, login-form
    print/       — comanda.tsx (conteúdo puro da comanda) + print-controller.tsx (dispara window.print())

  lib/
    prisma.ts           — singleton do PrismaClient
    auth.ts             — hash/verify (bcrypt), sessão JWT (jose), cookie httpOnly
    crypto.ts            — AES-256-GCM p/ criptografar client_secret fiscal (FISCAL_ENCRYPTION_KEY)
    rate-limit.ts         — limitador de tentativas de login (em memória, ver §7)
    money.ts              — formatCentsToBRL / reaisToCents (parser tolerante a "5.00" e "5,00")
    format.ts              — formatOrderNumber ("#001"), formatRelativeTime ("há 5 minutos"),
                              slugify (usado por seed.ts e pelos services de categoria/produto —
                              única fonte da verdade, antes duplicado só no seed)
    opening-hours.ts         — isStoreOpenNow (pausa manual + horário por dia da semana),
                              parseWeeklySchedule/defaultWeeklySchedule, WEEKDAYS/WEEKDAY_LABELS
    constants.ts            — TODAS as listas de valores válidos (status, pagamento, fiscal...)
    notification-sound.ts    — beep via Web Audio API (sem depender de arquivo .mp3)
    types.ts                  — tipos client-side de Category/Product (view models)
    validations/               — Zod: auth, order, settings, fiscal, category, product, delivery-zone
    services/                   — order-service, settings-service, fiscal-config-service,
                                  fiscal-service, category-service, product-service, upload-service
                                  (salva/apaga fotos de produto em public/uploads/products),
                                  admin-service (changePassword — exige senha atual correta),
                                  delivery-zone-service (CRUD de bairros, mesmo padrão de
                                  category-service — RESTRICT + active em vez de hard delete)
    fiscal/
      fiscal-provider.interface.ts  — contrato FiscalProvider (issue, name)
      index.ts                       — factory getFiscalProvider() (lê FiscalConfig do banco)
      providers/pending-provider.ts   — no-op, explica o que falta configurar
      providers/nuvem-fiscal-provider.ts — adapter real (OAuth2, empresas, certificado, NFC-e)

  store/
    cart-store.ts  — Zustand, persist só `items` (isOpen não é persistido)
```

---

## 4. Banco de dados

**PostgreSQL** (trocado de SQLite em 2026-07-09 — ver §2 e §15 para o motivo e o diagnóstico
completo do incidente de deploy). Continua trocável para MySQL mudando só `datasource` em
`schema.prisma` (nenhum código de aplicação depende do provider especificamente — sem
`$queryRaw`/`$executeRaw`).

### Migrations aplicadas (em ordem)
1. `20260707160000_init_postgresql` — schema completo atual (todas as tabelas), gerado do
   zero para Postgres. **Substitui as 6 migrations antigas em sintaxe SQLite** (`init`,
   `update_default_brand_colors`, `delivery_type_and_cash_change`,
   `fiscal_nfce_integration`, `accepted_payment_methods`, `delivery_zones`) — histórico
   reiniciado de propósito (ver §2), o schema final é o mesmo de antes da troca de banco.

### Models e relações

```
Admin 1───N OrderStatusHistory
Category 1───N Product
Product 1───N ProductAddon
Product 1───N OrderItem
Customer 1───N Order
DeliveryZone 1───N Order
Order 1───N OrderItem
Order 1───N OrderStatusHistory
Order 1───1 Fiscal
OrderItem 1───N OrderItemAddon
ProductAddon 1───N OrderItemAddon (opcional — addon pode ter sido removido do produto)
Settings — singleton (id="default")
FiscalConfig — singleton (id="default")
```

**Admin** — `id, name, email (unique), passwordHash, role (owner|staff), active, createdAt`.
Hoje só existe um admin; login autentica contra `findFirst({ active: true })` (ver §7).

**Category** — `id, name, slug (unique), order, active`. 7 categorias hoje: Lanches,
Pastéis, Pastéis de Brócolis, Pastéis Doces, Açaí, Fritas, Bebidas.

**Product** — `id, categoryId, name, slug (unique, prefixado por categoria — ex:
"lanches-calabresa" vs "pasteis-calabresa" — necessário porque vários pratos repetem nome
entre categorias), description, ingredients, priceCents, imageUrl, active, order`.
Campos fiscais (todos opcionais até o admin preencher): `ncm, cfop, csosnCst,
unidadeComercial (default "UN")`. **106 produtos** cadastrados hoje via seed.

**ProductAddon** — `id, productId, name, priceCents, active`. Adicionais são por produto
(não há grupo compartilhado no schema — o seed usa arrays JS reutilizados, tipo
`LANCHE_ADDONS`, mas cada produto tem sua própria cópia das linhas no banco).

**Customer** — `id, name, phone (unique), address (opcional — retirada não precisa),
addressNumber, neighborhood, complement, reference`. Upsert por telefone a cada pedido —
`neighborhood` é preenchido a partir do `DeliveryZone` escolhido (nunca texto livre do
cliente, ver §8), mas **não é um snapshot por pedido**: como o Customer é uma linha
reaproveitada por telefone, um pedido novo do mesmo cliente sobrescreve o campo (mesma
característica pré-existente de `address`/`addressNumber` — nada novo introduzido aqui).

**DeliveryZone** — `id, neighborhood (unique), feeCents, active, order`. Um bairro
atendido pela entrega, com sua própria taxa. Exclusão só permitida se nenhum pedido
referenciar o bairro (FK `orders.deliveryZoneId` é `RESTRICT`, mesmo padrão de
Category/Product) — do contrário, use `active` para tirar do checkout sem perder
histórico.

**Order** — campos principais: `orderNumber (Int, sequencial, gerado via
Settings.lastOrderNumber incrementado em transação)`, `status`, `deliveryType
(entrega|retirada)`, `paymentMethod (pix|dinheiro|cartao_credito|cartao_debito` — ver §8),
`cashChangeForCents` (só dinheiro — valor com que o cliente vai pagar, para calcular troco),
`deliveryZoneId` (bairro escolhido, só entrega — nulo em retirada), `itemsTotalCents,
deliveryFeeCents` (**snapshot** da taxa do bairro no momento do pedido — nunca recalculado
se a taxa do `DeliveryZone` mudar depois, mesmo espírito de `OrderItem.unitPriceCents`),
`totalCents, notes, printedAt`.

**OrderItem / OrderItemAddon** — **snapshot** do nome e preço no momento da compra
(mudar preço de um produto depois não afeta pedidos antigos).

**OrderStatusHistory** — auditoria de cada mudança de status (quem mudou, quando).

**Settings** (singleton) — nome/logo/cores da loja, WhatsApp, endereço, `storeOpen` (pausa
manual), `openingHours` (JSON com o horário de funcionamento por dia da semana — ver §8),
`acceptedPaymentMethods` (JSON array com as formas de pagamento aceitas — ver §8), pedido
mínimo, largura da bobina (58mm/80mm), `lastOrderNumber`. **`deliveryFeeCents` continua na
coluna do banco mas não é mais lido/gravado pela aplicação** — a taxa de entrega agora é
por bairro (`DeliveryZone`, ver §8), mesmo tipo de campo vestigial que `logoUrl` (existe,
mas sem fluxo que o use hoje).

**Fiscal** (1-1 com Order, criado automaticamente em TODO pedido) — `customerDocument
(CPF/CNPJ opcional), status (aguardando_emissao|emitida|erro), provider, ambiente,
externalId, numero, serie, chaveAcesso, pdfUrl, xmlUrl, xmlContent, errorMessage,
issuedAt`.

**FiscalConfig** (singleton) — provider ativo, ambiente, credenciais (client_secret
**criptografado** com AES-256-GCM via `FISCAL_ENCRYPTION_KEY`, nunca em texto puro), dados
cadastrais da empresa (CNPJ, razão social, IE, IM, regime tributário, endereço completo),
timestamps de quando a empresa foi registrada no provider e quando o certificado foi
enviado. **O arquivo .pfx e a senha do certificado nunca são persistidos** — são enviados
direto pro provider no momento do upload e descartados da memória do processo.

---

## 5. Variáveis de ambiente

Arquivo `.env` (não commitado; `.env.example` tem os placeholders):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | URL de conexão **PostgreSQL** (`postgresql://usuario:senha@host:5432/banco?sslmode=require`) — precisa estar configurada tanto localmente (`.env`) quanto na Vercel (Project Settings → Environment Variables), **para todos os ambientes** (Production/Preview/Development) |
| `JWT_SECRET` | sim | assina o cookie de sessão do admin — string aleatória ≥32 chars |
| `FISCAL_ENCRYPTION_KEY` | sim (se for usar fiscal) | criptografa `client_secret` da API fiscal no banco |
| `SEED_ADMIN_EMAIL` | não | default `admin@rutelanches.com.br` (usado só internamente, não aparece no login) |
| `SEED_ADMIN_PASSWORD` | não | default **`12345`** — **senha de teste, trocar antes de produção** |

Gerar segredos: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Este projeto não usa NextAuth** (autenticação é JWT próprio via `jose`, ver §6) — não
existem nem são necessárias `NEXTAUTH_SECRET`/`NEXTAUTH_URL`.

---

## 6. Autenticação e segurança

- **Login do admin**: só senha (sem e-mail no formulário — decisão explícita do cliente
  para simplificar testes). A API (`POST /api/auth/login`) autentica contra o primeiro
  admin ativo (`findFirst({ active: true }, orderBy: createdAt asc)`). Isso significa que
  **hoje o sistema assume um único administrador**; se precisar de múltiplos admins com
  senhas diferentes, vai precisar reintroduzir um identificador (e-mail ou usuário) no
  formulário e na query.
- **Sessão**: JWT assinado (HS256) em cookie httpOnly, `sameSite=lax`, `secure` em produção,
  7 dias de validade. Payload: `{ sub, email, name, role }`.
- **Rate limit de login**: em memória (`src/lib/rate-limit.ts`), 5 tentativas por 15 min por
  `IP:login`, bloqueio de 15 min ao estourar. **Limitação conhecida**: não sobrevive a
  restart do processo nem funciona em múltiplas instâncias — para isso, trocar por um
  store compartilhado (Redis) mantendo a mesma interface (`checkLoginRateLimit`,
  `registerFailedLoginAttempt`, `clearLoginAttempts`).
- **Troca de senha** (`ChangePasswordForm` em `/admin/configuracoes`, seção "Segurança"):
  `POST /api/auth/change-password` (`src/lib/services/admin-service.ts::changePassword`) —
  exige a senha atual correta (`verifyPassword` contra `Admin.passwordHash`) antes de gravar
  a nova (`hashPassword`, mesmo bcrypt do login). Nova senha exige mínimo de 6 caracteres
  (`changePasswordSchema` em `validations/auth.ts`). Não reintroduz nenhum campo novo no
  schema — só atualiza `passwordHash` do admin da sessão atual (`session.sub`), compatível
  com o modelo de admin único já existente. **A senha de teste `12345` (seed) ainda é o
  default de instalação — trocar pelo próprio painel antes de expor a aplicação
  publicamente.**
- **Proteção de rotas**: `src/proxy.ts` redireciona qualquer `/admin/*` (exceto
  `/admin/login`) sem cookie válido para o login. Todas as API routes sensíveis chamam
  `getSession()` de novo internamente (defesa em profundidade).
- **SEO**: `robots.ts` bloqueia `/admin` para crawlers; páginas admin têm
  `metadata.robots = { index: false, follow: false }`.
- **Validação**: toda entrada de API passa por `safeParse` do Zod antes de tocar o banco.

---

## 7. Módulo fiscal (NFC-e via Nuvem Fiscal)

**Importante: esta é uma integração real, não simulada.** Foi testada contra a API de
produção da Nuvem Fiscal (com credenciais fictícias, retornando erro real `invalid_client`
— confirma que a chamada HTTP está correta).

**Atualizado em 2026-07-14: a tela `/admin/fiscal` foi removida.** Provider, ambiente e
credenciais da Nuvem Fiscal agora vêm de variáveis de ambiente, e o certificado A1 vem de
um arquivo local no servidor (instalado manualmente na implantação) em vez de upload pelo
painel — ver §7.1 abaixo. `FiscalConfig` (banco) guarda só os dados cadastrais da empresa
emitente (CNPJ, razão social, endereço, CNAE) e o status do certificado/cadastro.

### Arquitetura
- `FiscalProvider` (interface) — `issue(input): Promise<FiscalIssueResult>`. Qualquer
  provider futuro (Focus NFe, PlugNotas) só precisa implementar essa interface.
- `getFiscalProvider()` (`src/lib/fiscal/index.ts`) — factory **assíncrona**. Provider/
  ambiente/credenciais vêm de `getFiscalEnvConfig()` (`src/lib/fiscal/env-config.ts`,
  variáveis de ambiente); CNPJ/regime tributário vêm de `FiscalConfig` (banco); o
  certificado é validado a cada chamada (`validateLocalFiscalCertificate`, ver §7.1).
  Decide entre `PendingProvider` (com motivo específico do que falta) ou
  `NuvemFiscalProvider` (se tudo configurado e o certificado válido).
- `NuvemFiscalProvider` — OAuth2 client_credentials (token cacheado em memória por
  `client_id`), `POST /empresas` (cadastro, com fallback para `PUT` se já existir), `PUT
  /empresas/{cnpj}/certificado` (upload do .pfx em base64), `POST /nfce` (emissão),
  `GET /nfce/{id}/xml` e `/pdf` (download autenticado). **Nada disso mudou** — só a fonte
  do certificado e das credenciais mudou (ver §7.1).

### 7.1. Certificado A1 — arquivo local, sem upload pelo painel (2026-07-14)

O certificado A1 (.pfx/.p12) **não fica no Git nem é enviado por upload no painel**. Ele é
instalado manualmente no servidor durante a implantação do cliente:

1. Copie o arquivo para `certs/` na raiz do projeto no servidor (pasta gitignored — ver
   `certs/README.md`), ex: `certs/certificado.pfx`.
2. No `.env` do servidor, defina:
   ```
   FISCAL_PROVIDER="nuvem_fiscal"
   FISCAL_AMBIENTE="homologacao"   # ou "producao"
   NUVEM_FISCAL_CLIENT_ID="..."
   NUVEM_FISCAL_CLIENT_SECRET="..."
   FISCAL_CERTIFICADO_PATH="./certs/certificado.pfx"
   FISCAL_CERTIFICADO_SENHA="..."
   ```
3. Reinicie a aplicação (`npm start`/restart do processo).

Na inicialização (`src/instrumentation.ts` → `ensureFiscalCertificateUploaded()` em
`src/lib/services/fiscal-certificate-service.ts`):
- valida que o arquivo existe, que a senha abre o `.pfx` (via `node-forge`) e que o
  certificado não está vencido — loga um erro amigável (`console.warn`) se algo estiver
  errado, sem derrubar a aplicação;
- se estiver tudo certo e ainda não tiver sido enviado (ou o certificado mudou desde o
  último envio — comparado por `FiscalConfig.certificadoValidoAte`), cadastra a empresa
  (`registerCompanyWithProvider`) e envia o certificado (`uploadCertificate`) para a Nuvem
  Fiscal automaticamente, gravando `empresaRegistradaEm`/`certificadoEnviadoEm` no banco.

`getFiscalProvider()` também revalida o certificado local a cada emissão (não só no boot) —
se o arquivo sumir ou vencer depois que a aplicação já estiver rodando, a emissão falha com
um erro amigável em vez de tentar usar um certificado inválido.

**Requer disco persistente** (VPS) — não funciona na Vercel, cujo sistema de arquivos é
efêmero (mesmo problema já documentado em §15). O deploy de produção deste módulo pressupõe
migração para um servidor com filesystem persistente.

### Fluxo de emissão

Disparado de duas formas (ambas chamam a mesma função):
1. **Manual**: admin clica "Emitir NFC-e" no pedido.
2. **Automático**: pedido muda de "Preparando" para "Saiu para entrega/retirada" e o cliente
   marcou "quero nota fiscal" no checkout (`Order.wantsInvoice`) — ver
   `src/app/api/orders/[id]/status/route.ts`.

```
issueFiscalDocumentForOrder(orderId)  [src/lib/services/fiscal-service.ts]
  ↓
Bloqueia se já está "emitida"
  ↓
Reivindica a linha atomicamente (status → "emitindo") — evita que o disparo manual e o
  automático emitam duas notas para o mesmo pedido se rodarem ao mesmo tempo
  ↓
Valida que TODOS os produtos do pedido têm ncm+cfop+csosnCst preenchidos
  (senão: erro claro listando quais produtos faltam, e libera a reivindicação)
  ↓
Monta payload NFCe padrão SEFAZ (ide, dest, det[], imposto.ICMS, pag[])
  ↓
provider.issue() → grava status/numero/serie/chaveAcesso/xml/pdf na tabela Fiscal
```

### O que precisa ser configurado antes de emitir de verdade
1. `.env` do servidor: `FISCAL_PROVIDER="nuvem_fiscal"`, `NUVEM_FISCAL_CLIENT_ID`/
   `NUVEM_FISCAL_CLIENT_SECRET` reais, `FISCAL_AMBIENTE` (ver item 5).
2. CNPJ/razão social/IE/regime tributário/endereço da empresa em `FiscalConfig` (já
   seedado com os dados da Rute Lanches — ver `prisma/seed.ts`, `seedFiscalConfig`).
3. Certificado A1 instalado em `certs/` no servidor + `FISCAL_CERTIFICADO_PATH`/
   `FISCAL_CERTIFICADO_SENHA` no `.env` — ver §7.1. Cadastro da empresa e envio do
   certificado para a Nuvem Fiscal acontecem sozinhos no boot da aplicação.
4. `/admin/produtos` → preencher NCM/CFOP/CSOSN-CST/unidade de cada produto que vai ser
   vendido com nota fiscal (106 produtos, nenhum tem isso preenchido ainda por padrão).
5. Trocar `FISCAL_AMBIENTE` para `"producao"` só depois de validar em homologação.

### ⚠️ Pontos que precisam de revisão por um contador antes de ir para produção
- **CSOSN/CST por produto**: hoje é um campo livre preenchido manualmente por produto —
  não há validação de que o código faz sentido para o regime tributário da empresa.
- **PIS/COFINS**: o adapter usa uma simplificação fixa (CST 49, sem tributação destacada
  por item) apropriada para Simples Nacional pagando via DAS. **Não é apropriada** para
  regime normal sem revisão.
- **Código do nó ICMS** (`ICMSSN{codigo}` vs `ICMS{codigo}`): construído
  programaticamente a partir do CSOSN/CST cadastrado, seguindo a convenção padrão SEFAZ.
  Testar em homologação para confirmar que a Nuvem Fiscal aceita exatamente esse formato.
- ~~Forma de pagamento → tPag: `cartao` sempre mapeia para "03" (crédito) porque o checkout
  não distingue crédito/débito~~ — **resolvido**: o checkout agora distingue `cartao_credito`
  (tPag "03") de `cartao_debito` (tPag "04") — ver §8.
- **Taxa de entrega**: mapeada para `vFrete` no total da nota (prática comum, mas
  confirmar se é assim que a contabilidade do cliente quer registrar).

---

## 8. Fluxo de pedidos — detalhes técnicos

- **Controle operacional da loja** (`src/lib/opening-hours.ts`): a loja fica fechada por
  dois motivos independentes, combinados em `isStoreOpenNow(settings)`:
  1. **Pausa manual** — `Settings.storeOpen` (toggle "Status da loja" em
     `/admin/configuracoes`). Se desligado, a loja fica fechada **na hora**, não importa o
     horário configurado.
  2. **Horário de funcionamento** — `Settings.openingHours`, um JSON por dia da semana
     (`{ dom: { enabled, open, close }, seg: {...}, ... }`, chaves em `WEEKDAYS`). Se o
     campo está em `"{}"` (nunca configurado — default de instalação), **não há restrição
     de horário**, só a pausa manual vale — mantém compatibilidade com instalações
     antigas que nunca mexeram nisso. Uma vez configurado, fora do horário do dia atual a
     loja fica fechada mesmo com a pausa manual ligada (aberta). Suporta horário que passa
     da meia-noite (ex: 18:00–02:00). O horário "agora" é calculado sempre no fuso
     `America/Sao_Paulo` (`Intl.DateTimeFormat`), independente do TZ do servidor.
  - `isStoreOpenNow()` é chamado em **três lugares**: `order-service.ts::createOrder`
    (bloqueia a criação do pedido com `OrderServiceError("STORE_CLOSED")` → 409), e nos
    Server Components `(site)/layout.tsx` e `(site)/checkout/page.tsx` (calculam o valor
    uma vez e passam como prop `storeOpen` para `SiteHeader`, `CartDrawer` e
    `CheckoutForm` — esses componentes em si não mudaram, só passaram a receber o valor
    computado em vez do campo bruto do banco).
  - **O cardápio (`(site)/page.tsx`) nunca verifica `storeOpen`** — pode ser sempre
    navegado, fechado ou aberto; só a finalização do pedido é bloqueada (carrinho e
    checkout mostram aviso e desabilitam o botão de finalizar).
  - Editor do horário: card "Horário de funcionamento" dentro de `SettingsForm`
    (`/admin/configuracoes`), um toggle + dois `<input type="time">` por dia. Salva junto
    com o resto das configurações no mesmo `PATCH /api/settings` (o schema Zod
    `weeklyScheduleSchema` valida a forma antes de virar `JSON.stringify(...)` para gravar
    na coluna).
- **Formas de pagamento aceitas** (`Settings.acceptedPaymentMethods`, controle puramente
  operacional — **não é** integração de pagamento online, é só dizer quais opções a loja
  aceita hoje):
  - 4 valores possíveis em `PAYMENT_METHODS` (`constants.ts`): `pix`, `dinheiro`,
    `cartao_credito`, `cartao_debito` (antes era um único `cartao` — a separação também
    corrigiu o `tPag` da nota fiscal, ver §7).
  - Card "Formas de pagamento aceitas" em `/admin/configuracoes` (dentro do mesmo
    `SettingsForm`) — checkboxes, salva junto com o resto em `PATCH /api/settings`. Precisa
    ficar com pelo menos 1 marcada (validado no client e via Zod,
    `acceptedPaymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1)`).
  - `parseAcceptedPaymentMethods()` (`constants.ts`) lê o JSON salvo; se estiver vazio ou
    corrompido, assume **todas** as formas — nunca queremos derrubar o checkout por um dado
    de configuração inválido (mesmo espírito de `parseWeeklySchedule`/`isStoreOpenNow`).
  - `CheckoutForm` só lista as formas aceitas (`acceptedPaymentMethods` calculado em
    `checkout/page.tsx` e passado como prop); `order-service.ts::createOrder` valida de novo
    no servidor e rejeita com `OrderServiceError("PAYMENT_METHOD_DISABLED")` → 409 se o
    cliente tentar forçar uma forma desativada direto na API (defesa em profundidade, mesmo
    padrão do `STORE_CLOSED`).
  - `getPaymentMethodLabel()` (`constants.ts`) é usado em vez de acessar
    `PAYMENT_METHOD_LABELS[...]` direto em qualquer lugar que exibe a forma de pagamento
    (Kanban, confirmação do pedido, comanda) — cai de volta pro valor bruto se for um pedido
    antigo com uma forma que não existe mais (proteção, não deve acontecer na prática hoje).
  - **A comanda impressa (`comanda.tsx`) agora mostra a forma de pagamento e o troco** (se
    dinheiro) no rodapé — isso **muda uma decisão anterior** documentada aqui (a comanda era
    propositalmente sem dados de pagamento); foi alterado a pedido explícito do cliente,
    para quem entrega/recebe saber se precisa separar troco antes de sair. O resto da
    comanda continua minimalista (sem cliente, sem total).
- **Taxa de entrega por bairro** (`DeliveryZone`, controle puramente operacional — sem
  integração de mapa/CEP):
  - Admin cadastra bairros com nome + taxa em `/admin/configuracoes` (`DeliveryZoneManager`,
    mesmo padrão de tabela+modal do `CategoryManager`). `active=false` tira o bairro do
    checkout sem apagar pedidos que já o usaram; exclusão só é permitida com zero pedidos
    (FK `RESTRICT`, ver §4).
  - `CheckoutForm` recebe só os bairros ativos (`listActiveDeliveryZones()`, calculado em
    `checkout/page.tsx`) — o campo "Bairro" virou um `<Select>` com a taxa de cada opção já
    visível, **não é mais texto livre**. **Se não houver nenhum bairro ativo cadastrado, o
    botão "Entrega" fica desabilitado e só resta "Retirada no local".**
  - `order-service.ts::createOrder` recalcula tudo no servidor: busca o `DeliveryZone` pelo
    `deliveryZoneId` recebido, confere que existe e está `active` (senão
    `OrderServiceError("DELIVERY_ZONE_UNAVAILABLE")` → 409, mesmo padrão de `STORE_CLOSED`/
    `PAYMENT_METHOD_DISABLED`) e usa `zone.feeCents` como `Order.deliveryFeeCents` — **nunca
    confia em taxa vinda do client**. O nome do bairro (`zone.neighborhood`) também
    sobrescreve o que o client mandou ao gravar `Customer.neighborhood`.
  - **Mudar a taxa de um bairro depois não recalcula pedidos antigos** — `deliveryFeeCents`
    já foi gravado no momento do pedido (testado manualmente: mudar a taxa de R$8 pra R$12
    não alterou um pedido já criado com aquele bairro).
  - Exibição usa a relação `order.deliveryZone` (incluída em `orderInclude`), não
    `order.customer.neighborhood` — o nome do bairro daquele pedido específico fica correto
    mesmo que o mesmo cliente faça outro pedido depois para um bairro diferente (Customer é
    reaproveitado por telefone, então seu campo `neighborhood` isolado não seria confiável
    para isso). Aparece no Kanban (`order-card.tsx`, "Taxa de entrega: R$ X,XX") e na comanda
    impressa (`ENTREGA: {bairro}` + `Taxa: R$ X,XX`).
- **Geração do número do pedido**: transação que incrementa `Settings.lastOrderNumber` e
  usa o valor resultante — evita duas requisições simultâneas gerarem o mesmo número.
- **Preços sempre recalculados no servidor** a partir do banco (nunca confia no preço que
  o client mandou) — ver `order-service.ts::createOrder`.
- **Entrega vs retirada**: `deliveryFeeCents` é zerado automaticamente se
  `deliveryType === "retirada"` (nenhum `DeliveryZone` é buscado nesse caso); endereço não
  é exigido nesse caso.
- **Troco**: se `paymentMethod === "dinheiro"` e o cliente informa quanto vai pagar
  (`cashChangeForCents`), o servidor valida que é `>= totalCents` antes de aceitar.
- **Impressão da comanda**: dispara automaticamente só na transição
  `recebido → preparando` (não em qualquer mudança de status). Abre
  `/admin/comanda/[id]?autoprint=1` numa popup (`window.open`), que chama `window.print()`
  após o conteúdo montar e fecha a janela sozinha depois (`afterprint`, só se
  `window.opener` existir). Botão "Reimprimir" no card do pedido abre a mesma página sem
  `autoprint`. A comanda é propositalmente **minimalista**: nome da loja, "PEDIDO #001",
  itens com adicionais/observações em CAIXA ALTA e fonte grande, e — a pedido explícito do
  cliente (ver bullets de pagamento e entrega acima) — forma de pagamento/troco e
  bairro/taxa de entrega no rodapé. Continua **sem** dados do cliente (nome/telefone/
  endereço) nem total geral (isso fica só no painel).
- **Alerta sonoro**: beep gerado via Web Audio API (sem arquivo de áudio), repete a cada
  8s enquanto houver pedido "recebido" não reconhecido; clicar em qualquer parte do card
  marca como reconhecido (para de repetir só aquele pedido).
- **Kanban só mostra**: pedidos de hoje + qualquer pedido ainda ativo (não
  entregue/cancelado) independente da data — pedidos entregues/cancelados de dias
  anteriores somem da lista (comportamento intencional, não bug).

---

## 9. Cardápio (seed)

`prisma/seed.ts` é a fonte da verdade do cardápio hoje — **não existe CRUD de produtos no
admin ainda** (só edição dos campos fiscais, ver §10). Rodar `npm run prisma:seed`:

⚠️ **`seedCatalog()` APAGA e recria** `Category`, `Product`, `ProductAddon`,
`OrderItem`, `OrderItemAddon` toda vez que roda. Ou seja, **rodar o seed de novo destrói
o histórico de itens de pedidos existentes** (os pedidos em si e `Fiscal` sobrevivem, mas
perdem a relação com os itens). Isso foi aceitável até agora porque o cardápio mudou
várias vezes nesta sessão; **tomar cuidado ao rodar o seed em produção com pedidos reais**.

Conteúdo atual (todos os preços conferidos contra os encartes reais do cliente):
- **Lanches** (21) — dogs, X-burgers, queijo/misto quente, churrasco, americano.
  Adicionais: só tempero/recheio (alface, bacon, cheddar, hambúrguer extra etc. — 15
  itens). **Não** têm mais batata/bebida/açaí como adicional (foram removidos a pedido).
- **Pastéis** (43) — salgados base + combinações numeradas (Carne 1-14, Queijo 1-5,
  Frango 1-12, Calabresa 1-4). Adicionais: 17 itens (recheios extras + doces).
- **Pastéis de Brócolis** (8)
- **Pastéis Doces** (5) — sem adicionais.
- **Açaí** (6 tamanhos) — adicionais próprios (creme de avelã, leite condensado, confeti, paçoca).
- **Fritas** (4 — Simples/Completa × P/G) — sem adicionais.
- **Bebidas** (19) — sem adicionais.

`WhatsApp` da loja em `Settings.whatsapp`: `(15) 99633-0266` (número real do cliente).

---

## 10. Funcionalidades prontas

- [x] Site público: cardápio por categoria (scroll-spy), modal de produto com adicionais e
  observação, carrinho (Zustand), checkout com entrega/retirada e troco, confirmação de pedido.
- [x] Painel admin: login (só senha), Kanban de 5 colunas com polling, alerta sonoro
  repetindo, stats do dia (pedidos/faturamento/ticket médio), configurações da loja.
- [x] Impressão de comanda automática (58mm/80mm) + reimpressão manual.
- [x] Módulo fiscal completo (config da empresa, certificado, emissão de NFC-e real via
  Nuvem Fiscal, status aguardando/emitida/erro, download de DANFCE).
- [x] Edição de campos fiscais por produto (tabela dedicada, complementar ao CRUD completo).
- [x] Segurança básica: rate limit de login, robots/noindex no admin, Zod em todas as APIs.
- [x] **CRUD completo de produtos** (`product-manager.tsx` + `product-service.ts`): criar,
  editar nome/categoria/preço/foto/descrição/ingredientes/ativo, gerenciar adicionais
  (adicionar/editar/remover) e excluir (bloqueado se o produto já foi usado em algum
  pedido — FK `order_items.productId` é `RESTRICT`; nesse caso, desative em vez de excluir).
- [x] **Upload de foto de produto** (`upload-service.ts` + `POST /api/products/upload-image`):
  botão "Enviar/Trocar foto" no modal do produto, preview imediato, "Remover foto". Arquivo é
  enviado via multipart (mesmo padrão do upload do certificado fiscal), salvo em
  `public/uploads/products/<uuid>.<ext>` (nome gerado no servidor, nunca o nome original do
  arquivo) e a URL pública é gravada em `Product.imageUrl` — nenhuma mudança de schema.
  Só aceita JPG/PNG/WEBP, máx. 5MB. Ao trocar a foto, editar sem foto ou excluir o produto,
  o arquivo antigo é apagado do disco automaticamente (best-effort, nunca falha o request).
  `/public/uploads` está no `.gitignore` (conteúdo do usuário, não versionado). Não há
  redimensionamento/otimização de imagem (sem `sharp` ou similar) — fica como está enviado.
- [x] **CRUD de categorias** (`category-manager.tsx` + `category-service.ts`): criar,
  renomear, ativar/desativar. Exclusão só é permitida se a categoria não tiver nenhum
  produto (mesmo inativo) — FK `products.categoryId` é `RESTRICT`; do contrário, apenas
  desative a categoria (ela some do site, mas os produtos continuam no banco).
  Reordenação (drag-and-drop) não foi implementada — o campo `order` só é setado
  automaticamente (categoria nova vai para o fim da lista).
- [x] **Controle operacional da loja** (`opening-hours.ts`, ver §8 para detalhes): pausa
  manual (já existia) + horário de funcionamento por dia da semana configurável em
  `/admin/configuracoes`, bloqueio automático de pedidos fora do horário (mesma mensagem e
  status 409 da pausa manual), aviso "Fechado no momento" no cardápio/carrinho/checkout, e
  o cardápio continua **sempre navegável** mesmo com a loja fechada (só a finalização do
  pedido é bloqueada). Sem restrição de horário configurada (`"{}"`, default), só a pausa
  manual vale — compatível com o comportamento anterior a essa mudança.
- [x] **Formas de pagamento aceitas** (`Settings.acceptedPaymentMethods`, ver §8): admin
  escolhe quais das 4 formas (Pix, Dinheiro, Cartão de crédito, Cartão de débito) aceita;
  checkout só mostra as ativas; servidor valida de novo (409 se tentar forçar uma
  desativada); troco continua exclusivo do dinheiro; forma escolhida aparece no Kanban, na
  confirmação do pedido e agora também na comanda impressa (com o troco, se dinheiro).
  Puramente operacional — **sem** integração de pagamento online.
- [x] **Taxa de entrega por bairro** (`DeliveryZone`, ver §8): admin cadastra bairros com
  taxa própria em `/admin/configuracoes` (criar, editar, ativar/desativar, excluir se nunca
  usado em pedido); checkout mostra um select só com bairros ativos (taxa já visível em
  cada opção); total recalculado ao trocar de bairro; servidor sempre recalcula a taxa a
  partir do banco (nunca confia no client) e bloqueia bairro inexistente/inativo (409);
  sem nenhum bairro ativo cadastrado, só "Retirada no local" fica disponível. Taxa é
  **snapshot** por pedido (mudar a taxa depois não altera pedidos já feitos — testado
  manualmente). Aparece no Kanban e na comanda impressa. Sem integração de
  mapa/CEP — só uma lista de bairros com taxa fixa, como pedido.

## 11. Pendências / não implementado

- [ ] **Reordenação de produtos/categorias** — o campo `order` existe e é respeitado na
  exibição, mas não há UI de drag-and-drop para reordenar; hoje só increment automático.
- [ ] **Relatórios** além do resumo simples do dia (sem gráficos, sem filtro por período).
- [ ] **Multi-admin** de verdade (login hoje ignora e-mail/usuário, ver §6).
- [ ] **Outros providers fiscais** (Focus NFe, PlugNotas) — a interface já suporta, só
  falta implementar o adapter.
- [ ] **Teste real da emissão de NFC-e** com certificado e credenciais verdadeiras (só foi
  testado o "caminho do erro" com credenciais fictícias).
- [ ] **Rate limit distribuído** (Redis) se for rodar em múltiplas instâncias.
- [ ] Trocar a senha de teste `12345` antes de qualquer uso com clientes reais.

## 12. Problemas conhecidos / gotchas do ambiente

- **Windows + preview server**: o `preview_stop` do harness às vezes não mata a árvore de
  processos do `next dev` no Windows (fica processo órfão ocupando a porta/travando o
  Prisma Client durante `generate`). Se `prisma generate`/`migrate` falhar com `EPERM`
  tentando renomear `query_engine-windows.dll.node`, encerrar os processos node do projeto
  antes de tentar de novo:
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*rute-lanches*' } | Stop-Process -Force
  ```
- **Cliques via automação/preview às vezes não disparam** o handler React (parece
  timing de hidratação do Next 16/Turbopack) — quando isso acontecer, um
  `location.reload()` antes de repetir a ação geralmente resolve. Isso é uma flakiness da
  ferramenta de preview usada durante o desenvolvimento, não um bug da aplicação (sempre
  confirmado via chamada direta a `fetch()` que o endpoint funciona).
- **`npm run build` local pode estourar memória** na etapa de type-check duplicado do
  Next (`Running TypeScript...`), especialmente com pouca RAM livre na máquina — não
  indica erro de código (rodar `npx tsc --noEmit` separado é a forma confiável de validar
  tipos localmente). A Vercel roda o build com bem mais memória disponível.

## 13. Próximos passos sugeridos

Ordem combinada com o cliente em 2026-07-06/07 (prioriza o que a dona vai sentir no dia a
dia; deixa o fiscal por último até validar com o contador):

1. ~~Upload de imagem de produto~~ — feito (ver §10/§11).
2. ~~Segurança: tela "alterar senha" no admin~~ — feito (ver §6). Ainda pendente, se
   necessário mais pra frente: multi-admin de verdade (hoje o login ignora e-mail/usuário,
   um único admin compartilha a mesma senha).
3. ~~**Ajustes de uso real**~~ — **completo**:
   - ~~Controle operacional da loja~~ (abrir/fechar manual + horário por dia da semana,
     bloqueio automático de pedidos fora do horário, aviso no cardápio, cardápio sempre
     navegável mesmo fechado) — feito (ver §8/§10).
   - ~~Formas de pagamento aceitas~~ (admin escolhe quais das 4 formas aceita, checkout só
     mostra as ativas, validação também no servidor) — feito (ver §8/§10).
   - ~~Taxa de entrega por bairro~~ (`DeliveryZone`, admin cadastra bairros com taxa
     própria, checkout mostra só os ativos, taxa é snapshot por pedido) — feito (ver §8/§10).
4. **Fiscal** (por último, só depois de falar com o contador): testar emissão de NFC-e em
   homologação com certificado e CNPJ reais da Rute Lanches; revisar CSOSN/PIS/COFINS.
5. Relatórios com filtro de período (semana/mês) além do resumo do dia.
6. Reordenação (drag-and-drop) de produtos/categorias/bairros no admin.
7. Se o volume de pedidos crescer: trocar polling por WebSocket/SSE e rate limit em
  memória por um store compartilhado.

---

## 14. Como rodar

Precisa de um banco **PostgreSQL** primeiro (local via Docker, ou um serviço na nuvem —
Vercel Postgres, Neon, Supabase — todos têm free tier e dão a `DATABASE_URL` pronta):

```bash
npm install
cp .env.example .env        # preencher DATABASE_URL (postgres), JWT_SECRET, FISCAL_ENCRYPTION_KEY
npm run prisma:migrate       # aplica as migrations no Postgres (cria as tabelas)
npm run prisma:seed          # cardápio real + admin (senha 12345) + settings
npm run dev
```

Site: `http://localhost:3000` · Admin: `http://localhost:3000/admin/login` (senha `12345`,
ou o valor de `SEED_ADMIN_PASSWORD` no `.env`).

Comandos úteis: `npm run build` (roda `prisma generate && prisma migrate deploy && next
build` — ver §15), `npm run lint`, `npm run prisma:studio` (editor visual do banco), `npm
run prisma:migrate` (nova migration a partir de mudanças no `schema.prisma`).

---

## 15. Deploy na Vercel — incidente de 2026-07-09 e correção

**Sintoma**: build passava na Vercel, mas qualquer página (inclusive a home) mostrava a
tela genérica "This page couldn't load / A server error occurred" com um código de erro.

**Causa raiz**: `DATABASE_URL` apontava para SQLite (`file:./dev.db`, um arquivo local).
Funções serverless da Vercel rodam num sistema de arquivos somente-leitura/efêmero — não
existe onde o SQLite gravar/ler o arquivo do banco em produção. Toda página pública já
passa por `prisma` logo de cara (`RootLayout` e `(site)/layout.tsx` chamam
`getSettings()`), então a request inteira quebrava antes de renderizar qualquer HTML.

**O que foi corrigido** (só infraestrutura/robustez — nenhuma mudança de UI, design ou
funcionalidade):
1. **`schema.prisma`**: `provider` trocado de `sqlite` para `postgresql` (ver §4 para o
   detalhe das migrations).
2. **`package.json`**: `"build"` agora roda `prisma generate && prisma migrate deploy &&
   next build` (aplica migrations pendentes a cada deploy) e `"postinstall": "prisma
   generate"` (garante que o client sempre é gerado, mesmo se o passo de build mudar).
3. **Fallback seguro em vez de 500** nas páginas públicas mais acessadas:
   - `getSettingsSafe()` (`settings-service.ts`) — se o banco estiver inacessível, retorna
     configurações padrão com `storeOpen: false` (mais seguro que fingir que está aberto)
     em vez de lançar. Usada em `RootLayout`, `(site)/layout.tsx` e `checkout/page.tsx`.
   - `(site)/page.tsx` — busca de categorias/produtos embrulhada em try/catch; se falhar,
     cai para lista vazia, que o `MenuBrowser` já trata com "Cardápio em atualização" (não
     precisou de UI nova).
   - `checkout/page.tsx` — bairros de entrega com o mesmo tratamento (lista vazia = só
     retirada, comportamento que já existia para "nenhum bairro cadastrado").
   - Todos os fallbacks logam com `console.error` e uma mensagem específica apontando pra
     `DATABASE_URL`/migrations — aparece nos **Vercel Function Logs** pra debug rápido.
4. **`src/app/error.tsx` e `src/app/global-error.tsx`** (novos — não existiam nenhum
   error boundary antes): qualquer erro não tratado que sobrar (ex: `JWT_SECRET` ausente
   derrubando uma página admin) agora cai numa tela própria da aplicação ("Algo deu
   errado" + botão "Tentar novamente" + código de referência), nunca mais na tela genérica
   da Vercel. `global-error.tsx` usa estilo inline (não Tailwind) de propósito — ele
   substitui o `<html>/<body>` inteiro e não pode depender do CSS ter carregado.

**Migrations**: as 6 migrations antigas (sintaxe SQLite) foram apagadas e substituídas por
uma única `20260707160000_init_postgresql/migration.sql`, gerada offline com `npx prisma
migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` (não
precisa de um Postgres real rodando pra gerar o SQL, só precisa de uma `DATABASE_URL` com
formato válido). Decisão discutida e confirmada com o cliente antes de apagar — segura
porque o banco de produção nunca tinha rodado nenhuma migration.

**O que NÃO foi possível testar neste ambiente** (sem Postgres disponível localmente):
`prisma migrate deploy` contra um banco real, e o `next build` completo (a etapa de
type-check duplicada do Next.js estourou a memória da máquina local — ambiente já estava
com pouca RAM livre; **não é um erro de código** — `tsc --noEmit` e `eslint` passaram
100% limpos, e o Next chegou a confirmar "Compiled successfully" antes de travar nessa
etapa redundante. A Vercel tem bem mais memória de build e não deve ter esse problema.

### Variáveis a cadastrar no painel da Vercel (Project Settings → Environment Variables)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | connection string do Postgres (Vercel Postgres/Neon/Supabase — inclua `?sslmode=require`) |
| `JWT_SECRET` | string aleatória ≥32 chars (gerar com o comando do §5) |
| `FISCAL_ENCRYPTION_KEY` | string aleatória ≥32 chars (só necessária se for usar o módulo fiscal) |
| `SEED_ADMIN_EMAIL` | opcional — só usado ao rodar o seed |
| `SEED_ADMIN_PASSWORD` | opcional — só usado ao rodar o seed; troque a senha pelo painel depois (ver §6) |

Marque todas para **Production**, **Preview** e **Development** (a menos que use bancos
diferentes por ambiente). Depois de configurar, redeploy — o `prisma migrate deploy` do
`build` script cria as tabelas automaticamente no primeiro deploy. Se o banco ainda
estiver vazio depois disso (cardápio não aparece), rode `npm run prisma:seed` **uma vez**
localmente apontando `DATABASE_URL` pro banco de produção (ou rode via `vercel env pull` +
`npx tsx prisma/seed.ts` localmente).

### Seed rodado em produção (2026-07-09)

Rodado manualmente contra o Neon de produção (`DATABASE_URL` passada inline, nunca
commitada): **7 categorias, 106 produtos**, settings padrão da loja e admin criado com
`admin@rutelanches.com.br` / senha `12345` (o cliente não tinha passado
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` customizados nesse run — **trocar a senha pelo
painel assim que possível**, ver §6).

### Bug encontrado logo depois: login com "Falha de conexão"

**Sintoma**: depois do site subir e o cardápio aparecer, o login do admin (`/admin/login`)
falhava com "Falha de conexão" — mensagem do catch genérico em `login-form.tsx`, que só
aparece quando o `fetch()` não consegue interpretar a resposta como JSON.

**Causa raiz**: `POST /api/auth/login` (`src/app/api/auth/login/route.ts`) não tinha
try/catch — se `JWT_SECRET` estiver ausente ou tiver menos de 16 caracteres na Vercel,
`createSessionToken()` lança (`getJwtSecret()` em `auth.ts`), a rota quebra sem devolver
corpo JSON, e o client interpreta isso como falha de rede em vez de erro de servidor.
**Confirmado localmente**: rodando o dev server contra o Postgres de produção, login
funcionou normalmente com `JWT_SECRET` válido (200, retornou os dados do admin); com
`JWT_SECRET` propositalmente curto, reproduziu exatamente o sintoma antes da correção.

**Correção**: `POST /api/auth/login` agora embrulha toda a lógica (consulta ao admin,
verificação de senha, criação do token) num try/catch — qualquer erro inesperado devolve
`{ error: "Erro ao processar login. Tente novamente em instantes." }` com status 500 (JSON
válido, o client mostra a mensagem certa) e loga o erro original completo com
`console.error` (aparece nos **Vercel Function Logs**, apontando exatamente qual variável
checar).

**Ação pendente do lado do cliente**: confirmar que `JWT_SECRET` está cadastrada na Vercel
(Project Settings → Environment Variables, para **Production**) com uma string aleatória
≥32 caracteres — é bem provável que essa variável não tenha sido cadastrada ainda (só
`DATABASE_URL` foi confirmada até aqui).

### Gotcha adicional: disco cheio na máquina de desenvolvimento

Durante esse diagnóstico, o disco C: da máquina local chegou a **0 bytes livres**, o que
impedia até `Edit`/`npm install` (`ENOSPC`). Não é um problema do projeto — mas se
reaparecer, procure instaladores/ISOs grandes soltos em Downloads (`.exe`, `.iso`,
`.msi`) que já cumpriram a função de instalar algo; são os maiores candidatos a apagar
com segurança antes de mexer no projeto de novo.

## 16. Infraestrutura de produção — VPS (2026-07-14)

O projeto ganhou suporte a dois caminhos de deploy em VPS (Ubuntu 24.04 recomendado),
sem depender da Vercel:

1. **PM2 direto no servidor** (`ecosystem.config.js` + `scripts/*.sh`) — o caminho mais
   simples, sem Docker. Node.js, PostgreSQL e Nginx instalados diretamente no sistema.
2. **Docker Compose** (`Dockerfile` + `docker-compose.yml` + `nginx/`) — app, postgres e
   nginx como containers, pra quem prefere isolamento/portabilidade.

Os dois caminhos usam o mesmo `.env` (copiado de `.env.production.example`) e os mesmos
diretórios persistentes: `certs/` (certificado A1, nunca no Git — ver §7.1), `logs/`,
`backups/`, `public/uploads/`.

### Scripts (`scripts/`)
- `install.sh` — primeira instalação: `npm ci` → `prisma generate` → `prisma migrate
  deploy` → seed → `next build` → `pm2 start`.
- `update.sh` — deploy de uma nova versão: `git pull` → `npm install` → `prisma migrate
  deploy` → `next build` → `pm2 restart`.
- `backup.sh` — `pg_dump` compactado em `backups/`, mantém os 14 mais recentes (ajustar
  `KEEP` conforme a rotina real). Pode ser agendado no cron.
- `restore.sh` — restaura um `.sql.gz` de `backups/` (pede confirmação explícita antes de
  sobrescrever o banco).

### Health check
`GET /api/health` (`src/app/api/health/route.ts`) — sem sessão, retorna `status`
("ok"/"degraded"), conexão com o banco (com latência), versão (`package.json`), uptime do
processo e `NODE_ENV`. Usado pelo healthcheck do `docker-compose.yml` e serve pra
monitoramento externo (uptime robot, etc.).

### Índices adicionados nesta preparação
`Order.customerId`, `Order.deliveryZoneId` e `OrderItem.productId` não tinham índice
(Postgres, ao contrário do MySQL, não cria automaticamente em chave estrangeira) — ver
migration `20260714170000_add_missing_fk_indexes`.

### PagBank e variáveis de ambiente — atenção
`.env.production.example` lista `PAGBANK_CLIENT_ID`/`PAGBANK_CLIENT_SECRET`/`PAGBANK_TOKEN`
só por completude/documentação — **essas variáveis não são lidas pelo código hoje**. As
credenciais do PagBank continuam configuradas pelo painel admin (Configurações → PagBank)
e ficam guardadas criptografadas na tabela `pagbank_config` (ver §PagBank em seções
anteriores). Se quiser migrar isso pra env vars também (mesmo padrão do fiscal), é uma
mudança de código à parte, não incluída nesta preparação de infraestrutura.
