# HANDOFF — Rute Lanches

> Documento oficial do projeto. Escrito para que qualquer pessoa (ou qualquer nova
> conversa com IA) consiga assumir o desenvolvimento **sem perder contexto**. Sempre que
> algo mudar de forma relevante, atualize este arquivo.
>
> Última atualização: 2026-08-13 (pedidos do cliente pós-lançamento: chave Pix simples com
> QR Code gerado localmente, sem depender do PagBank — ver §10.1; pedido Pix só entra no
> Kanban depois que o admin confirma manualmente o pagamento — ver §6.2; botão pra ocultar
> os valores de venda no dashboard, já que a tela fica visível pra qualquer um perto do
> balcão — ver §9.1). Atualização anterior (2026-08-06): reformulação grande do fluxo de
> pedidos: endereço/bairro
> digitado livremente, aprovação manual da entrega pelo admin, status "Pronto para
> retirada" separado de "Saiu para entrega", comanda reescrita com endereço/pagamento
> completos, avisos de WhatsApp pro cliente via link manual — ver §6 e §6.1). Atualização
> anterior (2026-08-03): leva do painel admin (dashboard com estatísticas, busca/filtros no
> Kanban, toasts, animações, sidebar responsiva no celular) — ver §9.1. Anterior a essa
> (2026-08-01): bairros com visibilidade admin-only — ver §7 (nota: essa funcionalidade foi
> **substituída** pela mudança de 2026-08-06, ver §6.1). Anterior a essa
> (2026-07-28): forma de pagamento "Combinar pelo WhatsApp" — ver §6. Anterior a essa
> (2026-07-15): auditoria da infraestrutura de deploy, sem alteração de funcionalidades.

---

## Índice

1. [Arquitetura completa do sistema](#1-arquitetura-completa-do-sistema)
2. [Tecnologias utilizadas](#2-tecnologias-utilizadas)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Banco de dados](#4-banco-de-dados)
5. [Fluxo de autenticação](#5-fluxo-de-autenticação)
6. [Fluxo de pedidos](#6-fluxo-de-pedidos)
7. [Fluxo da Venda no Balcão](#7-fluxo-da-venda-no-balcão)
8. [Fluxo do cliente (portal B2B)](#8-fluxo-do-cliente-portal-b2b)
9. [Fluxo do admin](#9-fluxo-do-admin)
10. [Fluxo do PagBank (Pix)](#10-fluxo-do-pagbank-pix)
11. [Fluxo da emissão fiscal (NFC-e)](#11-fluxo-da-emissão-fiscal-nfc-e)
12. [Fluxo da impressão](#12-fluxo-da-impressão)
13. [Configuração do VPS](#13-configuração-do-vps)
14. [Docker, PM2, Nginx e PostgreSQL](#14-docker-pm2-nginx-e-postgresql)
15. [Variáveis de ambiente](#15-variáveis-de-ambiente)
16. [Scripts de deploy/update/backup/restore](#16-scripts-de-deployupdatebackuprestore)
17. [Tudo que já foi implementado](#17-tudo-que-já-foi-implementado)
18. [Tudo que foi alterado nesta sessão](#18-tudo-que-foi-alterado-nesta-sessão)
19. [Bugs corrigidos](#19-bugs-corrigidos)
20. [Decisões arquiteturais e motivos](#20-decisões-arquiteturais-e-motivos)
21. [Pendências restantes](#21-pendências-restantes)
22. [Deploy completo em VPS do zero](#22-deploy-completo-em-vps-do-zero)
23. [Configurar PagBank, Nuvem Fiscal e certificado A1](#23-configurar-pagbank-nuvem-fiscal-e-certificado-a1)
24. [Checklist de produção](#24-checklist-de-produção)
25. [Credenciais/segredos necessários](#25-credenciaissegredos-necessários-sem-valores)
26. [Próximas melhorias sugeridas](#26-próximas-melhorias-sugeridas)

---

## 1. Arquitetura completa do sistema

Rute Lanches é um sistema de pedidos para uma lanchonete (Sorocaba/SP — Ruteneia Ferreira
Melo, nome fantasia "Rute Lanches"). É uma aplicação **Next.js monolítica** (App Router),
com um único banco Postgres, cobrindo:

- **Site público** (cardápio + checkout) para clientes finais fazerem pedidos.
- **Painel administrativo** (Kanban de pedidos, produtos, categorias, configurações,
  venda no balcão) para a equipe da loja.
- **Portal do cliente B2B** (`/cliente`) — uma área separada para empresas que assinam o
  sistema como clientes da plataforma (não confundir com "cliente" = consumidor final do
  lanche; ver §8).
- **Integrações externas**: PagBank (Pix) e Nuvem Fiscal (NFC-e).

```
┌─────────────────────────────────────────────────────────────────┐
│                        Navegador do usuário                      │
│   Cliente final       Admin/funcionário       Empresa-cliente    │
└──────┬───────────────────────┬───────────────────────┬──────────┘
       │ /                     │ /admin/*              │ /cliente/*
       ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js App Router (um único app)              │
│  src/proxy.ts (middleware) — protege /admin/* e /cliente/*        │
│  Route Handlers (src/app/api/**) — toda a lógica de servidor      │
│  Server Components — leem direto do Prisma (sem API intermediária)│
└──────┬───────────────────────────────────────┬──────────────────┘
       │ Prisma Client                          │ fetch()
       ▼                                         ▼
┌─────────────────┐                    ┌─────────────────────────┐
│   PostgreSQL     │                    │  APIs externas           │
│  (Neon em dev/   │                    │  - Nuvem Fiscal (NFC-e)  │
│   staging; VPS    │                    │  - PagBank (Pix)         │
│   em produção)    │                    └─────────────────────────┘
└─────────────────┘
```

**Sem microsserviços, sem fila de mensagens, sem cache externo (Redis etc.)** — tudo é
request/response síncrono dentro do próprio processo Next.js. Isso é deliberado (ver §20)
dado o porte do negócio (uma lanchonete, não uma rede).

### Camadas do código (server-side)

```
route.ts (API)  ──▶  services (src/lib/services/*)  ──▶  Prisma  ──▶  Postgres
                         │
                         └──▶  validations (zod, src/lib/validations/*)
```

- **`route.ts`**: só faz autenticação/parse/validação zod/chamada do service/formatar
  resposta HTTP. Nenhuma regra de negócio mora aqui.
- **`services`**: toda a regra de negócio. Lançam erros tipados (`XxxServiceError` com um
  `code`) que o `route.ts` traduz pro status HTTP certo.
- **Server Components** (páginas): podem chamar os services diretamente (sem passar por
  uma API route) quando é só leitura para renderizar a própria página.

---

## 2. Tecnologias utilizadas

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.2.10 |
| Linguagem | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Estilo | Tailwind CSS | ^4 |
| Banco | PostgreSQL | 16 (compose) / Neon (dev atual) |
| ORM | Prisma | ^6.19.3 |
| Validação | Zod | ^4.4.3 |
| Estado do carrinho | Zustand (+ `persist`/localStorage) | ^5.0.14 |
| Data-fetching client-side (Kanban) | @tanstack/react-query | ^5.101.2 |
| Autenticação | JWT via `jose`, cookies httpOnly | ^6.2.3 |
| Hash de senha | bcryptjs | ^3.0.3 |
| Certificado A1 (parse PKCS12) | node-forge | ^1.4.0 |
| Ícones | lucide-react | ^1.23.0 |
| Animações | framer-motion | ^13.0.0 |
| Toasts | sonner | ^2.0.7 |
| Processo em produção (sem Docker) | PM2 | (instalado no VPS) |
| Containers (opcional) | Docker + Docker Compose | — |
| Proxy reverso | Nginx | 1.27 (imagem Docker) / apt (bare-metal) |
| Emissão fiscal | API Nuvem Fiscal (NFC-e) | — |
| Pagamento Pix | API PagBank (PagSeguro) | — |

---

## 3. Estrutura de pastas

```
rute-lanches/
├── prisma/
│   ├── schema.prisma              # schema único, comentado em português
│   ├── seed.ts                    # cardápio real + admin + fiscal + cliente B2B seed
│   └── migrations/                # 7 migrations, ver §4
├── src/
│   ├── app/
│   │   ├── (site)/                # grupo de rotas do site público
│   │   │   ├── page.tsx           # home = cardápio
│   │   │   ├── checkout/page.tsx
│   │   │   ├── pedido/[id]/page.tsx  # confirmação/acompanhamento do pedido
│   │   │   └── layout.tsx
│   │   ├── admin/
│   │   │   ├── login/page.tsx     # única rota admin fora do grupo protegido
│   │   │   ├── comanda/[id]/page.tsx  # impressão (fora do layout admin, sem sidebar)
│   │   │   └── (protected)/       # exige sessão admin (ver proxy.ts)
│   │   │       ├── layout.tsx     # sidebar + checagem de sessão
│   │   │       ├── dashboard/     # Kanban de pedidos
│   │   │       ├── produtos/
│   │   │       ├── categorias/
│   │   │       ├── configuracoes/ # Settings + PagBank + bairros + trocar senha
│   │   │       └── nova-venda/    # Venda no Balcão
│   │   ├── cliente/                # portal B2B (fora de /admin, sessão própria)
│   │   │   ├── login/
│   │   │   ├── esqueci-senha/
│   │   │   └── painel/
│   │   └── api/                    # todas as Route Handlers, ver árvore completa abaixo
│   ├── components/
│   │   ├── admin/                  # Kanban, forms de config, Nova Venda, etc.
│   │   ├── client/                 # portal B2B
│   │   ├── print/                  # comanda + print-controller
│   │   ├── site/                   # cardápio, carrinho, checkout, Pix
│   │   └── ui/                     # Button/Input/Select/Modal/Textarea/Badge genéricos
│   ├── lib/
│   │   ├── services/                # regra de negócio (um arquivo por domínio)
│   │   ├── validations/              # schemas zod
│   │   ├── fiscal/                   # provider fiscal (interface + Nuvem Fiscal + pending)
│   │   ├── auth.ts / client-auth.ts  # sessão JWT admin / cliente B2B
│   │   ├── crypto.ts                 # AES-256-GCM p/ secrets no banco (PagBank)
│   │   ├── rate-limit.ts             # rate limit em memória
│   │   ├── constants.ts              # enums compartilhados (status, tipos, labels)
│   │   ├── prisma.ts                 # singleton do PrismaClient
│   │   └── types.ts / types/client.ts
│   ├── store/                        # cart-store.ts (site) + balcao-cart-store.ts (admin)
│   ├── instrumentation.ts            # boot hook — valida/envia certificado fiscal
│   └── proxy.ts                      # middleware (protege /admin/* e /cliente/*)
├── certs/                            # certificado A1 (.pfx) — NUNCA no Git
├── logs/                             # logs do PM2/nginx/scripts — NUNCA no Git
├── backups/                          # dumps do Postgres — NUNCA no Git
├── public/uploads/                   # fotos de produto — NUNCA no Git
├── nginx/default.conf                # config do reverse proxy
├── scripts/                          # install/update/backup/restore.sh
├── Dockerfile, docker-compose.yml, .dockerignore
├── ecosystem.config.js               # PM2
├── .env.production.example
└── HANDOFF.md                        # este arquivo
```

### Árvore completa de `src/app/api/`

```
api/
├── admin/pagbank/config/route.ts          GET/PUT   (sessão admin)
├── admin/pagbank/testar-conexao/route.ts  POST      (sessão admin)
├── auth/login/route.ts                    POST      (público, rate-limited)
├── auth/logout/route.ts                   POST      (sessão admin)
├── auth/change-password/route.ts          POST      (sessão admin)
├── categories/route.ts, [id]/route.ts     CRUD      (sessão admin)
├── client/auth/login/route.ts             POST      (público, rate-limited)
├── client/auth/logout/route.ts            POST
├── client/auth/change-password/route.ts   POST      (sessão cliente B2B)
├── client/profile/route.ts                GET/PUT   (sessão cliente B2B)
├── delivery-zones/route.ts, [id]/route.ts CRUD      (sessão admin)
├── health/route.ts                        GET       (público)
├── orders/route.ts                        POST público (rate-limited) / GET admin
├── orders/[id]/status/route.ts            PATCH     (sessão admin) — dispara fiscal automática
├── orders/[id]/print/route.ts             POST      (sessão admin)
├── orders/[id]/pix/route.ts               GET       (público — cria/consulta cobrança Pix)
├── orders/[id]/fiscal/issue/route.ts      POST      (sessão admin) — emissão manual
├── orders/[id]/fiscal/pdf/route.ts        GET       (sessão admin) — baixa o DANFCE
├── products/route.ts, [id]/route.ts       CRUD      (sessão admin)
├── products/[id]/fiscal/route.ts          PUT       (sessão admin) — NCM/CFOP/CSOSN
├── products/upload-image/route.ts         POST      (sessão admin)
├── settings/route.ts                      GET/PUT   (sessão admin)
└── webhooks/pagbank/route.ts              POST      (público, sem auth — ver §10)
```

---

## 4. Banco de dados

PostgreSQL. Provider único (`postgresql`), sem uso de enums nativos — todo campo de
"status"/"tipo" é `String` com os valores válidos documentados em comentário no schema
(escolha deliberada — ver §20). Valores monetários sempre em **centavos** (`Int`).

### Models e relações

```
Admin ──< OrderStatusHistory (changedBy)

Cliente (empresa B2B) ──< ClienteUsuario

Category ──< Product ──< ProductAddon
                     └──< OrderItem (via productId, sem cascade)

Customer (consumidor final) ──< Order

DeliveryZone ──< Order (Restrict on delete)

Order ──< OrderItem ──< OrderItemAddon
Order ──< OrderStatusHistory
Order ── 1:1 ── Fiscal
Order ── 1:1 ── PixCharge

Settings          (singleton, id fixo "default")
FiscalConfig       (singleton, id fixo "default")
PagBankConfig      (singleton, id fixo "default")
```

| Model | Papel | Observações-chave |
|---|---|---|
| `Admin` | usuário do painel | login só com senha (sem e-mail digitado — busca o primeiro admin ativo) |
| `Cliente` / `ClienteUsuario` | empresas assinantes do portal B2B | **não é o consumidor final** — ver §8 |
| `Category` / `Product` / `ProductAddon` | cardápio | `Product` tem `ncm`/`cfop`/`csosnCst`/`unidadeComercial` opcionais (fiscal) |
| `Customer` | consumidor final (quem faz o pedido) | `phone` é `@unique` — usado como chave de upsert |
| `DeliveryZone` | **legado** (ver §6.1/§7) — não é mais usado na criação de pedidos desde 2026-08-06, mantido só por compatibilidade com pedidos antigos e uso interno na Venda no Balcão |
| `Order` | pedido | `status` (kanban), `paymentStatus` (Pix), `deliveryType`, `wantsInvoice`, `paymentMethod`, `address`/`addressNumber`/`neighborhood`/`complement`/`reference` (snapshot do endereço digitado, só entrega — ver §6.1), `rejectionReason`, `notifiedStatuses` |
| `OrderItem` / `OrderItemAddon` | itens do pedido | snapshot de nome/preço no momento da compra |
| `OrderStatusHistory` | auditoria de mudança de status | |
| `Settings` | configuração da loja | cores, horário, forma de pagamento aceita, `pixKey`/`pixCity` (chave Pix simples — ver §10.1), etc. |
| `Fiscal` | NFC-e de um pedido | 1:1 com `Order`, criado junto (`aguardando_emissao`) |
| `FiscalConfig` | dados cadastrais da empresa emitente | **não** guarda mais credenciais (ver §11/§20) |
| `PagBankConfig` | credenciais do PagBank | client_id/secret/token **criptografados** no banco |
| `PixCharge` | cobrança Pix de um pedido | 1:1 com `Order`, criada sob demanda |

### Campos de "status" (strings, não enum nativo)

- `Order.status`: `"aguardando_pagamento" | "recebido" | "preparando" | "saiu_entrega" | "pronto_retirada" | "entregue" | "cancelado"`
  — `"saiu_entrega"` só pra `deliveryType="entrega"`, `"pronto_retirada"` só pra
  `"retirada"`/`"balcao"` (nunca os dois; ver `getNextStatus`/`getNextStatusActionLabel`
  em `src/lib/constants.ts`). `"recebido"` + `"entrega"` significa "aguardando
  confirmação da entrega" — ver §6.1. `"aguardando_pagamento"` só existe pra pedidos
  Pix pagos com a chave simples (ver §10.1/§6.2) — fica **fora do Kanban** até o admin
  confirmar manualmente.
- `Order.deliveryType`: `"entrega" | "retirada" | "balcao"`
- `Order.paymentMethod`: `"pix" | "dinheiro" | "cartao_credito" | "cartao_debito"`
- `Order.paymentStatus`: `"pendente" | "pago" | "erro"`
- `Fiscal.status`: `"aguardando_emissao" | "emitindo" | "emitida" | "erro"`
- `PixCharge.status`: `"aguardando_pagamento" | "pago" | "expirado" | "erro"`

### Índices e constraints relevantes

- `@@index([status])`, `@@index([createdAt])`, `@@index([customerId])`,
  `@@index([deliveryZoneId])` em `Order`.
- `@@index([productId])` em `OrderItem`.
- `@@index([externalId])` em `PixCharge` (consultado a cada webhook do PagBank).
- `Customer.phone`, `Order.orderNumber`, `Cliente.cnpj/email`, `Admin.email`,
  `DeliveryZone.neighborhood` — todos `@unique`.
- `onDelete: Cascade` em tudo que é "filho" de `Order`/`Product`/`Cliente`.
- `onDelete: Restrict` em `Order.deliveryZone` (não deixa apagar bairro com pedido).

### Migrations (ordem cronológica)

| Migration | O que fez |
|---|---|
| `20260707160000_init_postgresql` | schema inicial completo em Postgres (troca do SQLite — ver §12 do histórico/§20) |
| `20260714120000_add_client_portal` | `Cliente` + `ClienteUsuario` (portal B2B) |
| `20260714130000_add_cnae` | CNAE em `FiscalConfig`/`Cliente` |
| `20260714140000_add_payments_and_pagbank` | `Order.paymentStatus`/`wantsInvoice`, `PagBankConfig`, `PixCharge` |
| `20260714150000_add_pix_charge_external_id_index` | índice em `PixCharge.externalId` |
| `20260714160000_fiscal_config_env_based_credentials` | remove `provider`/`ambiente`/`clientId`/`clientSecretEncrypted` de `FiscalConfig` (foram para env vars) |
| `20260714170000_add_missing_fk_indexes` | índices que faltavam em FKs (`customerId`, `deliveryZoneId`, `productId`) |
| `20260801230000_add_delivery_zone_visibility` | `DeliveryZone.visibleToCustomers` (hoje sem uso prático — ver `20260806140000` abaixo) |
| `20260806140000_order_address_snapshot_and_approval` | `Order.address/addressNumber/neighborhood/complement/reference` (snapshot), `Order.rejectionReason`, `Order.notifiedStatuses` — ver §6.1. Faz backfill dos pedidos existentes a partir do Customer/DeliveryZone vinculado. |
| `20260813150000_pix_key_and_payment_gate` | `Settings.pixKey`/`Settings.pixCity` — ver §10.1. (`Order.status="aguardando_pagamento"` é só um novo valor de string, não precisa de migration — ver §6.2.) |

⚠️ **Nota histórica**: existe uma migration `20260703143145_init_postgres` registrada na
tabela `_prisma_migrations` do banco de produção que **não tem pasta correspondente** no
repositório (perdida antes desta sessão começar). Isso **não quebra nada** — `prisma
migrate deploy`/`status` continuam funcionando normalmente, é só uma nota informativa que
aparece no `migrate status`. Não tente "consertar" isso reescrevendo o histórico de
migrations — é arriscado e sem benefício real.

**Rodar migrations**: `npx prisma migrate deploy` (produção) — nunca `migrate dev` fora
de máquina local de desenvolvimento.

---

## 5. Fluxo de autenticação

Dois sistemas de sessão **completamente separados**, cada um com seu próprio cookie e
suas próprias funções, mas **compartilhando o mesmo `JWT_SECRET`**:

| | Admin (loja) | Cliente B2B |
|---|---|---|
| Cookie | `rl_session` | `rl_client_session` |
| Módulo | `src/lib/auth.ts` | `src/lib/client-auth.ts` |
| Login | só senha (busca 1º admin ativo) | e-mail + senha |
| Rota de login | `/admin/login` | `/cliente/login` |
| Rate limit | sim (`src/lib/rate-limit.ts`, 5 tentativas / 15 min) | sim (mesmo limitador, chave separada) |
| Middleware | `src/proxy.ts` protege `/admin/:path*` | `src/proxy.ts` protege `/cliente/:path*` |

- JWT assinado com `HS256` via `jose`, verificado (não só decodificado) em toda checagem
  de sessão. Duração 7 dias.
- Cookies: `httpOnly`, `secure` (só em produção), `sameSite: "lax"`.
- `JWT_SECRET` precisa ter **≥32 caracteres** (checado em runtime, lança erro se menor).
- Rotas de API fazem sua própria checagem via `getSession()`/`getClientSession()` — o
  middleware só protege as **páginas** (renderização), não as API routes (necessário
  porque algumas, como `POST /api/orders`, são públicas por design).
- Senha com bcrypt, custo 12.
- Login do cliente B2B usa um hash-dummy pra comparar mesmo quando o e-mail não existe
  (evita vazar por timing se a conta existe ou não).

---

## 6. Fluxo de pedidos

```
Cliente final navega o cardápio (/) → adiciona itens ao carrinho (zustand + localStorage,
chave "rl-cart") → /checkout → preenche dados → POST /api/orders
   ↓
createOrder() [src/lib/services/order-service.ts]
  - valida loja aberta (Settings + horário de funcionamento)
  - valida forma de pagamento aceita
  - recalcula preços/adicionais a partir do banco (nunca confia no valor do cliente)
  - upsert de Customer por telefone
  - transação: incrementa Settings.lastOrderNumber (row-lock do Postgres evita
    número duplicado em pedidos concorrentes) + cria Order + OrderItems + Fiscal
    (status "aguardando_emissao")
   ↓
Cliente é redirecionado pra /pedido/[id] — mostra status, resumo, e:
  - se Pix: PixPaymentPanel gerando a cobrança automaticamente (polling 5s)
  - se "Combinar pelo WhatsApp" (ver abaixo): WhatsAppOrderPanel com botão de confirmação
  - se entrega: total mostrado é só dos itens ("Total (sem a entrega)") — a taxa vira "A
    combinar" até o admin aprovar (ver §6.1)
   ↓
Se for Pix E a loja tiver `Settings.pixKey` cadastrada: o pedido nasce em
`status="aguardando_pagamento"` — NÃO aparece no Kanban ainda (fica num banner
separado até o admin confirmar o pagamento manualmente, ver §6.2/§10.1). Nos
outros casos (Pix sem chave cadastrada, dinheiro, cartão, combinar por WhatsApp),
segue direto pro fluxo normal abaixo.
   ↓
Pedido aparece no Kanban do admin (poll a cada 5s) em "Novo pedido"
   ↓
Se deliveryType="entrega": card mostra "⚠️ Aguardando confirmação da entrega" com
Aceitar/Recusar em vez do botão normal — ver §6.1. Retirada/balcão pulam essa etapa.
   ↓
Admin avança o status pelo Kanban (PATCH /api/orders/[id]/status), com concorrência
otimista: o Kanban manda o `previousStatus` esperado; se outro admin já mudou, a API
responde 409 e o Kanban avisa + recarrega. Toda transição é revalidada no backend
(`isValidStatusTransition` em order-service.ts) — o tipo de pedido decide o próximo
status válido, não só o que o frontend mandou.
   ↓
Transição "preparando" → "saiu_entrega" (entrega) ou "preparando" → "pronto_retirada"
(retirada/balcão) dispara automaticamente:
  1. emissão fiscal (se wantsInvoice) — ver §11
  2. impressão automática (popup + window.print()) — ver §12
   ↓
"pronto_retirada" → "entregue" (retirada/balcão) — status final, igual "entregue" de
uma entrega. Em cada mudança de status (exceto "recebido"/"cancelado"), o card mostra um
botão "Avisar cliente no WhatsApp" com a mensagem certa pronta — ver §6.1.
```

`DeliveryType` tem 3 valores: `"entrega"` (endereço digitado, taxa definida na aprovação),
`"retirada"` (sem taxa) e `"balcao"` (venda presencial criada pelo admin — ver §7).
Fiscalmente, `retirada` e `balcao` são tratados como `indPres: 1` (presencial); `entrega`
como `indPres: 4`.

### 6.1 Endereço livre, aprovação de entrega e avisos por WhatsApp (2026-08-06)

Antes, o cliente escolhia o bairro de uma lista pré-cadastrada (`DeliveryZone`), com taxa
fixa calculada automaticamente. Isso mudou: **o cliente digita o próprio endereço e
bairro livremente** — não existe mais lista, e a taxa não é mais calculada sozinha (não
tem como, sem saber o bairro de antemão). `DeliveryZoneManager`/`DeliveryZone` continuam
existindo no código (não foram apagados — ver §7 e comentário em
`configuracoes/page.tsx`), só não fazem mais parte do fluxo de pedido.

```
Checkout (entrega): cliente digita endereço + número + BAIRRO (texto livre) + complemento
+ ponto de referência → POST /api/orders
   ↓
createOrder(): grava um SNAPSHOT desses campos direto no Order (Order.address,
addressNumber, neighborhood, complement, reference) — não só no Customer, que é mutável
e pode ter endereço diferente em cada pedido. deliveryFeeCents fica 0 (pendente).
   ↓
Pedido cai no Kanban em "recebido" com o card mostrando "⚠️ Aguardando confirmação da
entrega" (order-card.tsx) em vez do botão normal — só acontece pra deliveryType="entrega".
   ↓
Admin vê endereço/bairro/referência no próprio card e decide:

  ACEITAR (POST /api/orders/[id]/approve-delivery, body {feeCents})
    → approveDelivery() em order-service.ts: só aceita se status="recebido" E
      deliveryType="entrega" (senão 400 NOT_PENDING_APPROVAL); define
      deliveryFeeCents/totalCents com o valor que o admin digitou (prompt simples) e
      avança pra "preparando" — dispara impressão automática da comanda já com o
      endereço completo.

  RECUSAR (POST /api/orders/[id]/reject-delivery, body {reason})
    → rejectDelivery(): cancela o pedido e grava Order.rejectionReason. Abre
      automaticamente um link wa.me pro CLIENTE com a mensagem de recusa (ver abaixo).
```

**Avisos de status pro cliente** (`src/lib/order-notifications.ts`): diferente do
"Combinar pelo WhatsApp" (que manda o pedido pra LOJA), isso manda uma mensagem de
status pro **cliente**, usando o telefone dele (`order.customer.phone`). Continua sendo
um **link `wa.me` que o admin clica** — não existe integração com a API oficial do
WhatsApp Business (Meta Cloud API/Twilio/Z-API) neste projeto, então não há envio 100%
automático sem ninguém tocar em nada. Decisão explícita do cliente (custo/burocracia de
contratar a API oficial ficou de fora por enquanto).

- Mensagens automáticas por status: `preparando`, `saiu_entrega`, `pronto_retirada`,
  `entregue` (textos em `getStatusNotificationMessage`). "recebido"/"cancelado" não têm
  mensagem de avanço — "cancelado" por recusa de entrega tem a sua própria
  (`getDeliveryRejectionMessage`, com o motivo se o admin preencheu).
- `Order.notifiedStatuses` (JSON array) marca quais status já tiveram o link clicado —
  `POST /api/orders/[id]/notify` grava isso. É só controle visual (o botão vira "Avisado
  — reenviar" em vez de sumir) — nada impede clicar de novo se precisar reenviar de
  verdade, já que o envio em si acontece dentro do WhatsApp do admin, fora do sistema.

**Pendências conhecidas desta mudança** (ver §21):
- Pedidos antigos (de antes de 2026-08-06) tiveram o endereço preenchido por uma migração
  a partir do cadastro atual do Customer/DeliveryZone vinculado — se o cliente mudou de
  endereço depois daquele pedido, o snapshot migrado pode não bater 100% com o endereço
  real daquele pedido específico (limitação inerente: o modelo antigo não guardava esse
  snapshot por pedido). Pedidos criados a partir de agora não têm esse problema.
- Venda no Balcão (`/admin/nova-venda`) também passou a exigir aprovação quando
  `deliveryType="entrega"` é escolhido ali — mesmo caminho único de código, sem duplicar
  lógica. Na prática, se o funcionário já sabe a taxa (está com o cliente/telefone na
  mão), ele mesmo aprova o próprio pedido logo em seguida no Kanban.

### 6.2 Pedido Pix só "entra" após confirmação de pagamento (2026-08-13)

Pedido a pedido do cliente: valores de venda expostos na tela do Kanban e Pix
que os clientes não conseguiam pagar (não tinha chave Pix cadastrada) — ver
§10.1 pra chave Pix e §9.1 pra ocultar valores. Este item é o "só lançar o
pedido depois do pagamento".

Só se aplica a **Pix com chave simples cadastrada** (`Settings.pixKey`
preenchida) — dinheiro/cartão são pagos na entrega/retirada, não tem como
confirmar antes, então continuam entrando direto no Kanban como sempre.
Pix sem chave cadastrada (fluxo legado do PagBank, que já confirma sozinho
pelo webhook) também não passa por aqui.

```
createOrder(): se paymentMethod="pix" E Settings.pixKey preenchida →
  Order nasce com status="aguardando_pagamento" (constante em
  src/lib/constants.ts, isValidStatusTransition só permite ir daqui pra
  "cancelado" ou, via confirmPixPayment, pra "recebido")
   ↓
listOrders() (usada pelo Kanban) EXCLUI status="aguardando_pagamento" — o
pedido não aparece nas colunas normais. listPendingPixPayments() lista só
esses, usada no banner laranja acima do Kanban (kanban-board.tsx), com
nome/valor/nº do pedido e botão "Confirmar pagamento".
   ↓
Admin confere o Pix caído no aplicativo do banco (não existe confirmação
automática — é um QR estático, sem webhook) e clica "Confirmar pagamento"
   ↓
POST /api/orders/[id]/confirm-payment → confirmPixPayment() em
order-service.ts: muda status→"recebido" + paymentStatus→"pago", grava
OrderStatusHistory — dali em diante segue o fluxo normal (inclusive
aprovação de entrega, se for o caso — ver §6.1).
```

Enquanto "aguardando_pagamento", o pedido também fica de fora do cálculo de
`getTodayStats()` (não conta como vendido nem como pedido em aberto) — só
passa a contar depois que o pagamento é confirmado.

### Forma de pagamento "Combinar pelo WhatsApp"

`PaymentMethod` inclui `"whatsapp"` — um pedido de verdade é criado no Kanban (mesmo
pipeline acima, com histórico/status normal), e o cliente confirma com a loja pelo
WhatsApp em vez de pagar ali. Ao enviar o pedido:

1. `CheckoutForm` tenta abrir automaticamente uma aba do WhatsApp (`window.open`, melhor
   esforço — pode ser bloqueado pelo navegador) com o pedido já formatado no texto
   (`src/lib/whatsapp.ts` → `buildWhatsAppOrderLink`/`orderToWhatsAppSummary`).
2. Em `/pedido/[id]`, o `WhatsAppOrderPanel` mostra o mesmo link como um botão manual —
   garante que o cliente sempre consegue confirmar mesmo se o popup foi bloqueado.
3. O número usado é `Settings.whatsapp` (Configurações → Identidade). Se estiver vazio, o
   painel avisa que a loja não configurou um número, em vez de gerar um link quebrado.

Só aparece como opção se o admin marcar "Combinar pelo WhatsApp" em Configurações →
Formas de pagamento aceitas (não vem marcado por padrão no seed). Não aparece na Venda no
Balcão (`/admin/nova-venda`) — não faz sentido "confirmar pelo WhatsApp" com o cliente já
no balcão, então a tela filtra essa opção da lista.

---

## 7. Fluxo da Venda no Balcão

Tela em `/admin/nova-venda` (`src/components/admin/nova-venda-screen.tsx`), acessível
pelo botão "Nova venda" no header do Kanban. **Reaproveita o mesmo `CheckoutForm`/
`ProductModal`/`createOrder()` do site** — não é um sistema separado (decisão explícita
do cliente, ver §20).

```
Funcionário busca produto por nome (busca nova, não existe no site) → ProductModal
(mesmo do site) adiciona ao carrinho isolado (useBalcaoCartStore, chave "rl-balcao-cart",
NÃO compartilha estado com o carrinho de um cliente navegando no mesmo navegador)
   ↓
CheckoutForm reaproveitado com props diferentes do site:
  - deliveryTypeOptions=["balcao","retirada","entrega"] (site só mostra entrega/retirada)
  - requireCustomerContact=false (nome/telefone opcionais)
  - submitLabel="Finalizar venda"
  - onOrderCreated (em vez de redirecionar pra /pedido/[id])
   ↓
Nome/telefone em branco → nome vira "Cliente Balcão", telefone vira um placeholder
sintético (crypto.getRandomValues, ~19 dígitos — entropia suficiente pra não colidir
entre vendas simultâneas; Customer.phone é @unique)
   ↓
POST /api/orders (mesmíssimo endpoint do site) → mesmíssimo pipeline de criação,
Kanban, emissão fiscal automática e impressão automática do §6
   ↓
Se Pix: mostra o PixPaymentPanel inline na própria tela (pra exibir o QR no balcão)
Se não-Pix: mostra "Venda registrada!" + botões "Nova venda" / "Ver pedidos"
```

### Bairros "só admin" (`DeliveryZone.visibleToCustomers`)

A Venda no Balcão usa `listActiveDeliveryZonesForStaff()` (todos os bairros ativos),
diferente do checkout do site, que usa `listActiveDeliveryZones()` (só
`visibleToCustomers=true`). Isso permite cadastrar em Configurações → "Bairros e taxa de
entrega" zonas de uso interno — ex: o endereço específico de um cliente fixo com taxa
combinada à parte (`"Casa da Dona Maria nº222"`, taxa mais alta) — sem que isso apareça
como opção pra qualquer cliente no checkout público. Basta desmarcar "Visível para o
cliente no site" ao criar/editar o bairro. A restrição de área de entrega (ex: só
Aparecidinha até o Éden, em Sorocaba) é feita da mesma forma: cadastre só os bairros
reais dentro da área desejada como `visibleToCustomers=true` — o cliente só consegue
escolher entre os bairros que existem na lista, não tem campo de texto livre.

---

## 8. Fluxo do cliente (portal B2B)

**Atenção ao nome ambíguo**: "cliente" aqui é o model `Cliente`/`ClienteUsuario` — uma
**empresa que assina a plataforma** (ex: se este sistema virar um produto vendido pra
várias lanchonetes), não o consumidor final que compra um lanche (esse é `Customer`).

```
/cliente/login (e-mail + senha) → POST /api/client/auth/login
   ↓
Sessão própria (rl_client_session) → /cliente/painel (protegido pelo proxy.ts)
   ↓
client-dashboard.tsx: perfil da empresa (razão social, CNPJ, endereço, plano,
status da assinatura), trocar senha (obriga troca no primeiro login via
deveAlterarSenha)
```

`/cliente/esqueci-senha` é uma página estática que só orienta a entrar em contato por
e-mail de suporte — **não existe fluxo automático de recuperação de senha** (ver §21).

Hoje só existe **um** cliente B2B seedado: Rute Lanches ela mesma (`prisma/seed.ts`,
`seedClienteRuteLanches`) — o portal foi construído mas não está sendo usado por
terceiros ainda.

---

## 9. Fluxo do admin

```
/admin/login (só senha) → sessão (rl_session) → /admin/dashboard (Kanban)

Sidebar (src/components/admin/sidebar.tsx):
  Pedidos       → /admin/dashboard   (Kanban, TodayStatsBar, botão "Nova venda")
  Produtos      → /admin/produtos    (CRUD produtos, fiscal por produto)
  Categorias    → /admin/categorias  (CRUD categorias)
  Configurações → /admin/configuracoes
                    - SettingsForm (loja: nome, cores, horário, formas de pagamento)
                    - PagBankConfigForm (credenciais Pix)
                    - DeliveryZoneManager (bairros/taxas)
                    - ChangePasswordForm
```

**Não existe mais tela "Fiscal"** no admin (removida nesta sessão — ver §11/§18/§20).
Emissão de nota por pedido continua existindo via `FiscalAction`
(`src/components/admin/fiscal-action.tsx`), dentro do card do pedido no Kanban.

### 9.1 Leva de melhorias de UI/UX do painel (2026-08-03)

- **Dashboard com mais estatísticas** (`today-stats.tsx` + `getTodayStats()` em
  `order-service.ts`): além de pedidos/faturamento/ticket médio do dia, agora mostra
  **pedidos em aberto** (qualquer dia, não só hoje) e **top 5 produtos mais vendidos hoje**
  (via `prisma.orderItem.groupBy`).
- **Ocultar valores em dinheiro (2026-08-13)**: pedido do cliente ("os valores ficam
  expostos a todos") — a tela do Kanban fica visível pra qualquer pessoa perto do
  balcão, não só pro admin. Botão "Mostrar/Ocultar valores" no topo de `TodayStatsBar`
  (`today-stats.tsx`) borra (`blur-sm`) "Vendido hoje"/"Ticket médio"; **oculto por
  padrão**, preferência salva em `localStorage` (`rl_admin_hide_values`) por
  navegador/dispositivo — não é uma configuração de servidor. Só afeta os totais
  agregados do dashboard; totais de pedido individual no Kanban continuam visíveis
  (o funcionário precisa deles pra cobrar/conferir o pedido).
- **Busca e filtros no Kanban** (`kanban-board.tsx`): campo de busca (nome/telefone/número
  do pedido) e chips de filtro por tipo de entrega — filtragem 100% client-side sobre os
  pedidos já carregados, não afeta o polling nem o alerta sonoro (que continuam olhando
  a lista **completa**, não a filtrada).
- **Toasts** (`sonner`, montado em `src/app/providers.tsx`): substituíram `window.alert`/
  mensagens inline de sucesso/erro em `product-manager`, `category-manager`,
  `delivery-zone-manager`, `settings-form`, `pagbank-config-form`,
  `change-password-form` e o conflito de status do Kanban.
- **`router.refresh()` no lugar de `window.location.reload()`** nesses mesmos formulários —
  atualiza os dados do Server Component sem recarregar a página inteira (mais rápido, sem
  flash branco na tela).
- **Animações com `framer-motion`**: `Modal` (`src/components/ui/modal.tsx`) agora anima
  entrada/saída de verdade (antes só tinha CSS de entrada, saía sem transição); cards do
  Kanban entram/saem com `AnimatePresence`; a sidebar mobile é uma gaveta animada.
- **Sidebar responsiva** (`sidebar.tsx`): em telas pequenas vira uma barra superior com
  hamburger + gaveta deslizante (antes era uma coluna fixa de 240px sempre visível,
  inutilizável no celular). O layout admin (`(protected)/layout.tsx`) mudou de
  `min-h-screen`/`h-screen` fixo em cada página para uma cadeia `h-screen` → `flex-1
  overflow-y-auto` no `<main>`, então páginas internas usam `h-full` (não `h-screen`
  diretamente) para não estourar a viewport quando a barra mobile está visível.
- **Busca de produtos** (`product-manager.tsx`) e **toggle rápido de ativo/inativo** direto
  na listagem (antes só existia em categorias/bairros, não em produtos).
- **Code-splitting**: `ProductModal`, `PixPaymentPanel`, `WhatsAppOrderPanel` e
  `FiscalAction` viraram `next/dynamic` — cada um só entra no bundle do cliente quando
  realmente é usado (ex: `FiscalAction` só quando um pedido está "Entregue"), em vez de
  todo card do Kanban ou todo produto do cardápio carregar esse JS de cara.
- **Bug corrigido**: `Fiscal.status = "emitindo"` (estado transitório usado pra evitar
  NFC-e duplicada, ver §11) não estava mapeado em `FISCAL_STATUS_LABELS`/`STATUS_STYLES` —
  o card mostrava literalmente "undefined" nesse status. `FiscalStatus` agora inclui
  `"emitindo"` como um label válido (fora de `FISCAL_STATUSES`, que continua só com os 3
  valores "configuráveis").
- **Bug corrigido**: botão "Cancelar pedido" no card do Kanban não pedia nenhuma
  confirmação — um clique acidental cancelava o pedido na hora. Agora pede confirmação,
  igual às outras ações destrutivas do painel.

---

## 10. Fluxo do Pix

### 10.1 Chave Pix simples (caminho principal, desde 2026-08-13)

A loja não precisa de conta/API do PagBank pra receber Pix. Em
`/admin/configuracoes` o admin cadastra `Settings.pixKey` (CPF/CNPJ/e-mail/
telefone/chave aleatória) e `Settings.pixCity`. Com isso:

```
Pedido criado com paymentMethod="pix" → /pedido/[id] renderiza PixPaymentPanel
  → GET /api/orders/[id]/pix → getOrCreatePixCharge() [pagbank-service.ts]
  - se Settings.pixKey estiver preenchida: gera o BR Code (Pix "copia e cola")
    localmente com generatePixBRCode() [src/lib/pix-brcode.ts] — payload EMV
    padrão Banco Central (chave + valor do pedido + CRC16), sem chamar API
    nenhuma — e renderiza o QR Code (pacote `qrcode`, imagem data: URL)
  - se não houver chave cadastrada: cai no fluxo legado do PagBank (ver 10.2)
```

**Não existe confirmação automática nesse caminho** (não há webhook — é só um
QR estático). O pedido fica com `status="aguardando_pagamento"` (fora do
Kanban, ver §6.2) até o admin conferir o Pix caído no aplicativo do próprio
banco e clicar em "Confirmar pagamento" no banner laranja acima do Kanban
(`POST /api/orders/[id]/confirm-payment` → `confirmPixPayment()` em
`order-service.ts`), que move o pedido pra `status="recebido"` e
`paymentStatus="pago"`.

### 10.2 PagBank (legado, mantido por compatibilidade)

Só é usado se `Settings.pixKey` estiver vazia. Configuração pelo painel
(`/admin/configuracoes` → bloco PagBank) — client_id/secret/token ficam
**criptografados** (AES-256-GCM, `src/lib/crypto.ts`, chave
`FISCAL_ENCRYPTION_KEY`) na tabela `pagbank_config`. Nesse caminho o pedido
Pix **não** passa por `aguardando_pagamento` — cria direto em "recebido"
(igual às outras formas de pagamento) porque a confirmação chega sozinha pelo
webhook:

```
PagBank → POST /api/webhooks/pagbank (SEM autenticação de assinatura — ver §21)
   ↓
Extrai id/reference_id do corpo, acha o PixCharge correspondente
   ↓
NÃO confia no status do corpo — sempre reconfirma direto na API do PagBank
(confirmPixChargePaid, server-to-server) antes de marcar como pago
   ↓
markPixChargePaid(): atualiza PixCharge.status="pago" + Order.paymentStatus="pago"
  (usa updateMany com guard "status != pago"/"status != cancelado" — idempotente e
  não reabre um pedido cancelado)
   ↓
Sempre responde 200 rapidamente (mesmo se não achar nada) — evita retry agressivo
```

Rate-limited (30 req/min por IP) como mitigação de abuso, já que não há verificação de
assinatura (ver pendência em §21).

---

## 11. Fluxo da emissão fiscal (NFC-e)

### Configuração (mudou bastante nesta sessão — ver §18/§20)

- **Provider/ambiente/credenciais da Nuvem Fiscal**: variáveis de ambiente
  (`FISCAL_PROVIDER`, `FISCAL_AMBIENTE`, `NUVEM_FISCAL_CLIENT_ID`,
  `NUVEM_FISCAL_CLIENT_SECRET`) — **não tem mais tela no admin pra isso**.
- **Dados cadastrais da empresa** (CNPJ, razão social, endereço, CNAE...): tabela
  `FiscalConfig`, editados só via `prisma/seed.ts` (já preenchidos com os dados reais da
  Rute Lanches).
- **Certificado A1**: arquivo local no servidor (`certs/certificado.pfx`, fora do Git) +
  senha (`FISCAL_CERTIFICADO_SENHA`). Instalado manualmente pelo cliente/operador na
  implantação — **não tem upload pelo painel**.

### Boot da aplicação (`src/instrumentation.ts`)

```
register() → ensureFiscalCertificateUploaded() [fiscal-certificate-service.ts]
  1. valida o .pfx local (existe? senha correta? não vencido?) — node-forge
  2. se válido e ainda não enviado: registra a empresa + envia o certificado
     pra Nuvem Fiscal automaticamente (mesmos endpoints que antes eram acionados
     por botão no admin)
  3. loga erro amigável (console.warn/error) se algo estiver errado — nunca derruba
     a aplicação
```

`getFiscalProvider()` (`src/lib/fiscal/index.ts`) revalida o certificado **a cada
emissão** também (não só no boot) — se o certificado sumir/vencer depois que a app já
está rodando, a emissão falha com erro amigável em vez de tentar usar algo inválido.

### Emissão (`issueFiscalDocumentForOrder`, `src/lib/services/fiscal-service.ts`)

Disparada de duas formas (mesma função):
1. **Manual** — botão "Emitir NFC-e" no card do pedido.
2. **Automática** — pedido muda pra "Saiu para entrega/retirada" **e** `wantsInvoice`
   está marcado.

```
1. Bloqueia se já está "emitida"
2. Reivindica a linha atomicamente (status → "emitindo") — evita que emissão manual
   e automática rodando ao mesmo tempo gerem DUAS notas fiscais reais pro mesmo pedido
3. Valida que todo item tem ncm/cfop/csosnCst preenchido no produto — senão libera
   a reivindicação e lança erro listando os produtos incompletos
4. Monta payload NFCe padrão SEFAZ e chama a Nuvem Fiscal
5. Grava status/numero/serie/chaveAcesso/xml/pdf/erro na tabela Fiscal
```

⚠️ **Nenhum produto tem NCM/CFOP/CSOSN preenchido ainda** (ver §21) — a emissão vai
falhar (graciosamente, com erro registrado) até isso ser preenchido em
`/admin/produtos` para cada produto que for vendido com nota.

---

## 12. Fluxo da impressão

**Não existe integração real com impressora de rede/térmica.** "Impressão automática"
hoje é: popup do navegador + `window.print()` do sistema operacional.

```
Kanban (kanban-board.tsx) detecta a transição de status:
  - "recebido" → "preparando": abre popup /admin/comanda/[id]?autoprint=1
  - "preparando" → "saiu_entrega": idem
   ↓
print-controller.tsx (dentro do popup): faz POST /api/orders/[id]/print
(marca printedAt), espera 350ms, chama window.print(), fecha o popup depois
do evento afterprint
```

Requer que o painel Kanban esteja aberto numa aba do navegador do computador da loja, e
que a impressora esteja configurada como padrão no sistema operacional (idealmente sem
diálogo de confirmação, via configuração do driver/SO). **Construir impressão real via
ESC/POS teria que ser um projeto à parte** (precisa saber modelo/conexão da impressora).

---

## 13. Configuração do VPS

Dois caminhos de deploy documentados, ambos assumindo **Ubuntu 24.04** com disco
persistente (⚠️ **não funciona na Vercel** — filesystem efêmero quebra tanto o
certificado local quanto o SQLite antigo já quebrou no passado):

1. **PM2 direto no servidor** — sem Docker. Node.js 20+, PostgreSQL e Nginx instalados
   via `apt`.
2. **Docker Compose** — app + postgres + nginx como containers.

Ver §22 para o passo a passo completo do zero.

---

## 14. Docker, PM2, Nginx e PostgreSQL

### `Dockerfile`
Multi-stage (`base` → `deps` → `builder` → `runner`), tudo com a mesma imagem base
(`node:20-slim`) pra garantir que o binário nativo do Prisma seja gerado pro SO certo.

- `builder`: `npx prisma generate` + `npx next build` (com `output: "standalone"` no
  `next.config.ts`). Usa uma `DATABASE_URL` **placeholder** só pra satisfazer a validação
  — o build não abre conexão de verdade (nenhuma página estática depende do banco).
- `runner`: copia `public/`, `.next/standalone`, `.next/static`, `prisma/`,
  `prisma.config.ts` e **o `node_modules` completo do builder** (não só subpastas —
  corrigido nesta sessão, ver §19: o CLI do Prisma precisa de dependências próprias tipo
  `dotenv`/`c12`/`effect` que não estavam sendo copiadas).
- `CMD`: `npx prisma migrate deploy && node server.js` — aplica migrations pendentes
  toda vez que o container sobe, **antes** de servir tráfego.

### `docker-compose.yml`
Serviços: `postgres` (com healthcheck `pg_isready`), `app` (depende do postgres saudável,
healthcheck via `GET /api/health`), `nginx` (depende do app saudável — corrigido nesta
sessão, antes só esperava o processo existir), `certbot` (perfil `tools` — não sobe com
`docker compose up`, só roda sob demanda via `docker compose run --rm certbot ...` para
emitir/renovar o certificado HTTPS). Volumes persistentes: `postgres_data` (nomeado),
`./public/uploads`, `./certs`, `./logs`, `./nginx/certbot` (certificados emitidos),
`./nginx/webroot` (desafio HTTP-01 do certbot) — todos bind mounts.

O container `app` roda como **root** (sem usuário dedicado) de propósito: `certs/` e
`public/uploads/` são bind mounts do host, e um usuário não-root dentro do container
seria dono/UID diferente do dono desses arquivos no host — bloquearia a leitura do
certificado A1 e a escrita de fotos de produto. Mesmo modelo de confiança do PM2 (processo
roda com o usuário que o inicia no host).

### `ecosystem.config.js` (PM2)
`script: "node_modules/next/dist/bin/next", args: "start"` (mais confiável que
`pm2 start npm -- start`). `autorestart`, `max_restarts: 10`, `max_memory_restart: "512M"`,
logs em `logs/pm2-out.log`/`logs/pm2-error.log`, `NODE_ENV=production`.

### `nginx/default.conf`
Reverse proxy `location / { proxy_pass http://app:3000; ... }`, endpoint pro desafio do
certbot (`/.well-known/acme-challenge/`), bloco HTTPS **comentado** (descomentar depois
de rodar o certbot), `client_max_body_size 15M` (upload de foto de produto).

### PostgreSQL
Em dev/staging atual: Neon (serverless Postgres). Em produção real: o container
`postgres:16-alpine` do compose, ou um Postgres gerenciado externo (basta trocar
`DATABASE_URL`).

---

## 15. Variáveis de ambiente

Referência completa em **`.env.production.example`** (commitado, só placeholders). Lista
do que é **realmente lido pelo código** (`process.env.*`):

| Variável | Usada em | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | Prisma (datasource) | sim |
| `JWT_SECRET` | `auth.ts`, `client-auth.ts`, `proxy.ts` | sim, ≥32 chars |
| `FISCAL_ENCRYPTION_KEY` | `crypto.ts` (criptografa segredos do PagBank no banco) | sim, ≥32 chars |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `prisma/seed.ts` | só no seed |
| `FISCAL_PROVIDER` | `src/lib/fiscal/env-config.ts` | não (default `"pending"`) |
| `FISCAL_AMBIENTE` | idem | não (default `"homologacao"`) |
| `NUVEM_FISCAL_CLIENT_ID` / `NUVEM_FISCAL_CLIENT_SECRET` | idem | só se `FISCAL_PROVIDER="nuvem_fiscal"` |
| `FISCAL_CERTIFICADO_PATH` / `FISCAL_CERTIFICADO_SENHA` | `fiscal-certificate-service.ts` | só se for emitir nota de verdade |
| `APP_URL` | `pagbank-service.ts` (monta a notification_url do webhook) | recomendada em produção |
| `NODE_ENV` | várias (cookie `secure`, etc.) | definida pelo ambiente (`production`) |
| `PORT` | Next.js / PM2 / Docker | não (default 3000) |

⚠️ **`PAGBANK_CLIENT_ID`/`PAGBANK_CLIENT_SECRET`/`PAGBANK_TOKEN`** aparecem no
`.env.production.example` só por completude/documentação (o cliente pediu
explicitamente) — **o código não lê essas variáveis hoje**. As credenciais do PagBank
continuam vindo do painel admin, criptografadas no banco (tabela `pagbank_config`). Se um
dia quiser migrar isso pra env vars (mesmo padrão do fiscal), é uma mudança de código à
parte.

`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` só são usadas pelo **container**
`postgres` do `docker-compose.yml` (não pelo Next.js).

---

## 16. Scripts de deploy/update/backup/restore

Todos em `scripts/`, POSIX shell, `set -euo pipefail`, sempre fazem `cd` pra raiz do
projeto primeiro. **Precisam de `chmod +x scripts/*.sh` depois do `git clone`** (o bit
executável não sobrevive a um `git` rodando no Windows).

| Script | O que faz |
|---|---|
| `install.sh` | `npm ci` → `prisma generate` → `prisma migrate deploy` → `tsx prisma/seed.ts` → `next build` → `mkdir -p logs certs backups public/uploads` → `pm2 start ecosystem.config.js --env production` → `pm2 save` |
| `update.sh` | `git pull` → `npm install` → `prisma generate && migrate deploy` → `next build` → `pm2 restart` |
| `backup.sh` | `pg_dump $DATABASE_URL \| gzip` → `backups/rute-lanches_<timestamp>.sql.gz`, mantém os 14 mais recentes (ajustar `KEEP` conforme a rotina real). Pensado pra rodar via cron. |
| `restore.sh` | Recebe o caminho do `.sql.gz`, **pede confirmação explícita** ("digite 'sim'") antes de sobrescrever o banco com `gunzip \| psql`. |

`backup.sh`/`restore.sh` carregam `DATABASE_URL`/`POSTGRES_USER`/`POSTGRES_DB` do `.env`
via `set -a; source .env; set +a`. Ambos **detectam automaticamente** se o Postgres está
rodando via Docker Compose (`docker compose ps -q postgres`) — nesse caso rodam
`pg_dump`/`psql` **de dentro do container** (`docker compose exec -T postgres ...`), já que
o serviço `postgres` do compose não expõe porta pro host (só existe na rede interna
`internal`; `DATABASE_URL` com host `postgres` não resolveria fora dos containers). Fora do
Docker (PM2 + Postgres local/gerenciado), usam `pg_dump`/`psql` direto no host, como antes.

---

## 17. Tudo que já foi implementado

- Cardápio público com categorias, busca por adicionais/observações/quantidade no modal
  de produto.
- Checkout do site (entrega com bairro/taxa, retirada, Pix/dinheiro/cartão/Combinar pelo
  WhatsApp, troco, opt-in de nota fiscal com CPF/CNPJ).
- Criação de pedido com recomputação de preço no servidor, numeração sequencial segura
  contra concorrência.
- Painel admin: Kanban com concorrência otimista, alerta sonoro de pedido novo, produtos,
  categorias, bairros de entrega, configurações da loja, troca de senha.
- **Venda no Balcão** (`/admin/nova-venda`) — reaproveitando checkout/carrinho do site.
- Portal do cliente B2B (login, perfil, troca de senha obrigatória no primeiro acesso).
- **PagBank**: configuração no admin, geração de cobrança Pix (QR + copia-e-cola),
  confirmação via webhook com reverificação server-to-server, painel de pagamento
  reaproveitado no site e na Venda no Balcão.
- **Emissão fiscal NFC-e** via Nuvem Fiscal: manual e automática (no "saiu para
  entrega/retirada"), com certificado A1 local validado automaticamente no boot.
- Impressão automática via popup + `window.print()`.
- Rate limiting em login admin/cliente, criação de pedido, geração de Pix, webhook.
- Health check (`/api/health`).
- Infraestrutura de deploy completa: Docker, PM2, Nginx, scripts de install/update/
  backup/restore.

---

## 18. Tudo que foi alterado nesta sessão

Esta conversa cobriu, em ordem, os seguintes grandes blocos de trabalho (cada um com
commit próprio no `git log`):

1. **Fix do login admin** quebrando com "Falha de conexão" — faltava try/catch ao redor
   da criação do token de sessão; causa raiz era `JWT_SECRET` ausente/curto na Vercel.
2. **Atualização do cadastro fiscal** com os dados oficiais reais da empresa (CNPJ, IE,
   IM, endereço, CNAE) — `FiscalConfig`, `Cliente` e `Settings` sincronizados.
3. **Auditoria completa de segurança/concorrência** (2 agentes em paralelo) — corrigiu:
   race condition na emissão fiscal duplicada, race no `PixCharge`, falta de rate
   limiting em várias rotas, timing leak no login do cliente, chaves JWT/criptografia
   com mínimo de entropia baixo, validações de input incompletas, índice faltando.
4. **Integração PagBank (Pix)** completa: config admin, geração/consulta de cobrança,
   webhook com reconfirmação server-to-server, painel de pagamento no site.
5. **Emissão fiscal automática** no "saiu para entrega" (antes só manual) + **impressão
   automática** estendida pra essa mesma transição.
6. **Remoção da tela "Fiscal" do admin** — certificado A1 passou a vir de arquivo local
   (`certs/`) + env vars, com validação e envio automático no boot da aplicação.
7. **Venda no Balcão** (`/admin/nova-venda`) — nova tela reaproveitando
   `CheckoutForm`/`ProductModal` (parametrizados) e um carrinho isolado.
8. **Preparação de infraestrutura de produção**: Dockerfile, docker-compose, nginx, PM2,
   scripts de deploy/backup/restore, `.env.production.example`, `/api/health`, índices de
   FK faltando.
9. **Revisão final de produção** com testes reais em todos os fluxos — encontrou e
   corrigiu os bugs listados em §19.
10. **Este HANDOFF.md** (reescrito do zero, mais completo e reorganizado).

Ver `git log --oneline` no repositório pra mensagens de commit detalhadas de cada etapa.

---

## 19. Bugs corrigidos

Lista de todos os bugs reais encontrados e corrigidos nesta sessão (por testes reais e/ou
auditoria de código), do mais recente ao mais antigo:

- **Crítico** — `prisma/seed.ts`: `seedCatalog()` apagava incondicionalmente **todos** os
  `OrderItem`/`OrderItemAddon`/produtos/categorias antes de recriar o cardápio, toda vez
  que o seed rodava. Como `scripts/install.sh` roda o seed sempre que é executado,
  reexecutar `install.sh` por engano num sistema já em produção apagaria histórico de
  pedidos reais e todo o trabalho manual de NCM/CFOP/CSOSN feito produto a produto —
  corrigido: agora aborta se já existir qualquer `Order` no banco, e pula o reseed do
  catálogo (sem apagar nada) se já existir alguma `Category`, a menos que
  `SEED_FORCE_CATALOG=true` seja definido explicitamente.
- **Alto** — `Dockerfile`: container rodava como usuário não-root dedicado (`nextjs`), mas
  `certs/` e `public/uploads/` são bind mounts do host (`docker-compose.yml`) — o UID do
  usuário dentro do container quase nunca bate com o dono desses arquivos no host, o que
  bloquearia silenciosamente a leitura do certificado A1 e a escrita de fotos de produto
  enviadas pelo admin. Corrigido: container agora roda como root (mesmo modelo de
  confiança do deploy via PM2, onde o processo já roda com o usuário que o inicia no
  host).
- **Alto** — `scripts/backup.sh`/`restore.sh`: chamavam `pg_dump`/`psql` diretamente no
  host usando `DATABASE_URL` — mas o serviço `postgres` do `docker-compose.yml` não expõe
  porta pro host (só existe na rede interna do compose), então o host `postgres` da URL
  nunca resolveria fora dos containers. Os scripts simplesmente não funcionavam no deploy
  via Docker. Corrigido: os dois agora detectam automaticamente Postgres rodando via
  Docker Compose e executam `pg_dump`/`psql` de dentro do container.
- **Alto** — `docker-compose.yml`: o serviço `nginx` não montava nenhum volume em
  `/var/www/certbot`, mas `nginx/default.conf` serve o desafio ACME HTTP-01 exatamente
  desse caminho — a emissão de certificado HTTPS pelo certbot sempre falharia no deploy
  via Docker Compose. Corrigido: adicionado volume `./nginx/webroot:/var/www/certbot` e
  um serviço `certbot` sob demanda (perfil `tools`) com o comando pronto documentado em
  §22.
- `certs/README.md`/HANDOFF §23: instrução pedia `chmod 600` no certificado A1, o que
  também quebraria a leitura no deploy via Docker pelo mesmo motivo do UID acima —
  trocado para `chmod 644`.
- **Crítico** — `Dockerfile`: estágio final não copiava as dependências do CLI do Prisma
  (`dotenv`, `c12`, `effect`, `deepmerge-ts`, `empathic`) nem `prisma.config.ts` — o
  container entraria em **crash-loop** ao tentar `prisma migrate deploy` no start.
- **Alto** — Checkout do site: o carrinho persistido (zustand + localStorage) ainda não
  tinha reidratado quando o guard de "carrinho vazio" rodava, redirecionando **todo
  cliente de volta pro cardápio** pouco depois de abrir `/checkout`.
- Checkout do site: quando não há bairro de entrega cadastrado, o formulário abria com
  "Entrega" (desabilitada) selecionada por padrão em vez de "Retirada", mostrando campos
  de endereço inúteis.
- `GET /api/health` vazava a mensagem de erro bruta do Prisma no corpo público da
  resposta (poderia expor host/porta do banco durante uma indisponibilidade).
- Telefone sintético gerado na Venda no Balcão (`Date.now() + Math.random()*1000`) tinha
  risco real de colisão entre vendas simultâneas — trocado por gerador com muito mais
  entropia (`crypto.getRandomValues`).
- `docker-compose.yml`: nginx podia subir e começar a proxied antes do app estar
  saudável (só esperava o container existir, não o healthcheck passar).
- Race condition: emissão fiscal manual + automática rodando ao mesmo tempo podiam gerar
  **duas NFC-e reais** pro mesmo pedido — corrigido com reivindicação atômica
  (status `"emitindo"`) antes de chamar o provider.
- Race condition: duas requisições simultâneas de `GET /api/orders/[id]/pix` podiam
  ambas tentar criar o `PixCharge` e uma delas quebrar com erro de constraint única.
- `updateOrderStatus` não tinha proteção contra dois admins mudando o mesmo pedido ao
  mesmo tempo (last-write-wins silencioso) — agora usa concorrência otimista
  (`previousStatus`), respondendo 409 em conflito.
- Webhook do PagBank podia, em teoria, reabrir/pagar um pedido já cancelado — corrigido
  com guard `status != "cancelado"` no update.
- Falta de rate limiting em: login do cliente B2B, criação de pedido, geração de Pix,
  webhook do PagBank (só o login admin tinha antes).
- Timing leak no login do cliente B2B (bcrypt só rodava se o e-mail existisse, revelando
  por tempo de resposta se a conta existia) — corrigido com hash-dummy.
- `JWT_SECRET`/`FISCAL_ENCRYPTION_KEY` só validavam **comprimento mínimo de 16**
  caracteres apesar da documentação pedir 32 — corrigido a checagem.
- Validações de input incompletas: `cpfCnpj` sem formato, `cashChangeForCents` sem teto,
  campos de endereço do portal do cliente sem limite de tamanho.
- Índice faltando em `PixCharge.externalId` (consultado a cada webhook) e em
  `Order.customerId`/`Order.deliveryZoneId`/`OrderItem.productId`.

---

## 20. Decisões arquiteturais e motivos

| Decisão | Motivo |
|---|---|
| Monolito Next.js (sem microsserviços/fila) | Porte do negócio (uma lanchonete) não justifica a complexidade operacional. Reavaliar só se o sistema virar multi-tenant de verdade (vários clientes B2B ativos ao mesmo tempo). |
| Status como `String`, não enum nativo do Postgres | Portabilidade entre ambientes de dev (SQLite, no passado) e produção (Postgres) sem migração de tipo; documentado em comentário no schema. |
| Postgres em vez de SQLite | Incidente real: Vercel tem filesystem efêmero, SQLite não sobrevive entre deploys/invocações — forçou a migração logo no início do projeto. |
| Certificado A1 em arquivo local + env vars (não mais tela admin) | Pedido explícito do cliente pra simplificar a implantação — o operador instala o certificado manualmente durante o deploy, sem depender de upload via navegador. Consequência aceita: **exige disco persistente**, então incompatível com Vercel (daí a migração pra VPS). |
| Credenciais do PagBank no banco (criptografadas), não em env var | O cliente configura pelo painel no dia a dia (pode trocar ambiente sandbox/produção sem precisar reiniciar o servidor ou mexer no `.env`) — diferente do fiscal, que é configurado uma vez na implantação. |
| Venda no Balcão reaproveitando `CheckoutForm`/`ProductModal` (props parametrizadas) em vez de tela nova do zero | Pedido explícito do cliente: "não duplicar código, não criar sistema separado". Os componentes viraram genéricos (qual carrinho usar, quais tipos de entrega mostrar, contato obrigatório ou não) mantendo o comportamento padrão do site 100% igual. |
| Webhook do PagBank sem verificação de assinatura, mas sempre reconfirmando server-to-server | Não há documentação seguríssima de qual header o PagBank usa hoje pra assinatura — decidiu-se mitigar o risco real (marcar pedido como pago indevidamente) reconfirmando direto na API deles, em vez de confiar no corpo da notificação. Rate limit como mitigação adicional de abuso. Ver pendência em §21. |
| Impressão via popup + `window.print()`, não ESC/POS real | Construir integração de verdade com impressora térmica de rede/USB exige saber modelo/conexão específicos, que não estavam disponíveis — ficou documentado como limitação conhecida, não implementado às pressas de forma arriscada. |
| Rate limiting em memória (`Map`), não Redis | Simplicidade — o PM2 roda em `instances: 1`/modo fork (não cluster), então não há múltiplos processos com estado de rate-limit divergente. Documentado que precisa virar Redis se escalar horizontalmente. |
| Reivindicação atômica (`"emitindo"`) em vez de lock de banco explícito pra evitar NFC-e duplicada | Mudança mínima e local (um campo de status a mais), sem precisar de infraestrutura de lock distribuído — suficiente porque o app roda como processo único. |
| Docker builder copia `node_modules` completo no runner (não só subpastas) | Depois de descobrir que copiar só `.prisma`/`@prisma`/`prisma`/`tsx` quebrava `prisma migrate deploy` no CMD (faltavam dependências transitivas do CLI do Prisma), decidiu-se pela cópia completa — perde um pouco do ganho de tamanho do `output: standalone`, mas é a opção correta e sem risco de "whack-a-mole" de dependência faltando. |

---

## 21. Pendências restantes

- **NCM/CFOP/CSOSN por produto**: nenhum dos ~106 produtos do cardápio tem esses campos
  preenchidos — a emissão fiscal (manual ou automática) vai falhar graciosamente até
  isso ser feito produto a produto em `/admin/produtos`.
- **Certificado A1 real**: precisa ser instalado manualmente em `certs/certificado.pfx`
  no VPS de produção (hoje só existe a estrutura/validação, não um certificado real).
- **Credenciais reais da Nuvem Fiscal e do PagBank**: ainda não configuradas em nenhum
  ambiente real (só testadas com credenciais ausentes/erros tratados).
- **Webhook do PagBank sem verificação de assinatura**: mitigado por reconfirmação
  server-to-server + rate limit, mas não é autenticação de verdade. Implementar quando
  se tiver a documentação exata do header de assinatura da PagBank em mãos.
- **Recuperação de senha do portal do cliente**: não existe fluxo automático — só uma
  página estática pedindo pra contatar o suporte por e-mail.
- **Sessões JWT sem revogação**: trocar a senha não invalida tokens já emitidos em outros
  dispositivos (só expiram naturalmente em 7 dias).
- **`JWT_SECRET` compartilhado** entre sessão admin e sessão do cliente B2B — dois
  domínios de confiança diferentes usando a mesma chave.
- **Sem token de acesso dedicado no link do Pix** (`/pedido/[id]`) — a proteção é só o
  `id` ser um cuid não-adivinhável, não uma autenticação de verdade.
- **Impressão não é real** (ESC/POS) — depende do navegador + diálogo de impressão do
  SO, como explicado em §12/§20.
- Migration histórica órfã (`20260703143145_init_postgres`, ver §4) — inofensiva, só
  cosmética no `migrate status`.
- **Avisos de WhatsApp pro cliente não são automáticos de verdade** (ver §6.1) — é um
  link `wa.me` que o admin precisa clicar e confirmar o envio manualmente. Pra ser 100%
  automático (sem ninguém clicar em nada), precisa contratar a API oficial do WhatsApp
  Business (Meta Cloud API) ou um provedor tipo Z-API/Twilio — decisão explícita do
  cliente de deixar isso de fora por enquanto (evita custo/burocracia de verificação de
  conta comercial).
- **Snapshot de endereço em pedidos anteriores a 2026-08-06**: preenchido por migração a
  partir do cadastro do Customer/DeliveryZone na época da migração, não do que estava
  valendo quando aquele pedido específico foi feito (ver §6.1).
- **Confirmação de pagamento Pix (chave simples) é 100% manual** (ver §6.2/§10.1): como é
  um QR estático gerado localmente (sem API/webhook), não existe forma de confirmar
  sozinho que o Pix caiu — o admin precisa conferir no aplicativo do banco e clicar
  "Confirmar pagamento". Se ele esquecer, o pedido fica parado indefinidamente no banner
  (fora do Kanban) — não há lembrete/alerta sonoro pra isso hoje (só existe pra pedidos já
  confirmados, "recebido"). Se isso incomodar na prática, dá pra reaproveitar o mesmo
  alarme sonoro do Kanban pra esses também.
- **Sem timeout/expiração pro banner de "aguardando pagamento" do Pix**: um pedido nessa
  fila fica lá para sempre até alguém confirmar ou cancelar manualmente — não existe
  cancelamento automático de pedido Pix "esquecido".

---

## 22. Deploy completo em VPS do zero

### Opção A — PM2 (recomendado pela simplicidade)

```bash
# 1. Sistema
sudo apt update && sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 2. Banco
sudo -u postgres createuser rutelanches -P
sudo -u postgres createdb rutelanches -O rutelanches

# 3. Código
git clone <seu-repo> rute-lanches && cd rute-lanches
cp .env.production.example .env
nano .env                 # preencher DATABASE_URL, JWT_SECRET, FISCAL_ENCRYPTION_KEY...
chmod +x scripts/*.sh     # necessário — bit executável não vem do Git no Windows

# 4. Certificado A1 (se for emitir NFC-e de verdade)
#    copiar o .pfx real para certs/certificado.pfx
#    preencher FISCAL_CERTIFICADO_SENHA no .env

# 5. Instalação
./scripts/install.sh

# 6. Nginx + HTTPS
sudo cp nginx/default.conf /etc/nginx/sites-available/rute-lanches
sudo ln -s /etc/nginx/sites-available/rute-lanches /etc/nginx/sites-enabled/
# editar server_name pro domínio real
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br

# 7. Deixar o PM2 sobreviver a reboot
pm2 startup    # rodar o comando que ele imprimir
pm2 save

# 8. Agendar backup diário
crontab -e
# adicionar: 0 3 * * * cd /caminho/do/projeto && ./scripts/backup.sh >> logs/backup.log 2>&1
```

### Opção B — Docker Compose

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
git clone <seu-repo> rute-lanches && cd rute-lanches
cp .env.production.example .env
nano .env
chmod +x scripts/*.sh
# certificado real em certs/certificado.pfx (chmod 644 — ver certs/README.md)

docker compose build
docker compose up -d
docker compose exec app npx tsx prisma/seed.ts   # só na primeira vez

# HTTPS (depois de apontar o DNS pro servidor): emitir o certificado via o
# serviço "certbot" do próprio compose (sem precisar instalar certbot no host)
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d seu-dominio.com.br -d www.seu-dominio.com.br \
  --email seu-email@exemplo.com --agree-tos --no-eff-email
# Editar nginx/default.conf: trocar "seu-dominio.com.br" pelo domínio real e
# descomentar o bloco "server { listen 443 ssl; ... }"
docker compose restart nginx

# Renovação (repetir a cada ~60 dias, ou agendar no cron do host):
#   docker compose run --rm certbot renew && docker compose restart nginx
```

### Depois do primeiro deploy (ambas opções)
1. Testar `curl https://seu-dominio.com.br/api/health` — deve retornar `"status":"ok"`.
2. Logar em `/admin/login` com a senha do seed e **trocar a senha imediatamente**.
3. Fazer um pedido de teste real pelo site e verificar que aparece no Kanban.
4. Configurar PagBank e Nuvem Fiscal (ver §23).

---

## 23. Configurar PagBank, Nuvem Fiscal e certificado A1

### PagBank
1. Login no admin → `/admin/configuracoes` → seção "PagBank (Pix)".
2. Preencher Client ID / Client Secret / Token reais (sandbox pra testar, produção
   quando validado).
3. Escolher ambiente (Sandbox/Produção).
4. Clicar "Testar conexão" — deve confirmar sucesso.
5. Definir `APP_URL` no `.env` do servidor com o domínio real (usado na
   `notification_url` do webhook) e reiniciar a aplicação.
6. Fazer um pedido Pix de teste e confirmar que o QR/copia-e-cola aparecem.

### Nuvem Fiscal
1. No `.env` do servidor: `FISCAL_PROVIDER="nuvem_fiscal"`, `NUVEM_FISCAL_CLIENT_ID`,
   `NUVEM_FISCAL_CLIENT_SECRET`, `FISCAL_AMBIENTE="homologacao"` (trocar pra
   `"producao"` só depois de validar).
2. Os dados cadastrais da empresa (CNPJ, razão social, endereço, CNAE) já estão
   preenchidos via seed — conferir em `prisma/seed.ts` → `seedFiscalConfig` se precisar
   ajustar algo.
3. Reiniciar a aplicação — o boot valida o certificado (próximo passo) e, se tudo OK,
   cadastra a empresa e envia o certificado automaticamente.

### Certificado A1
1. Copiar o arquivo `.pfx`/`.p12` real para `certs/certificado.pfx` no servidor.
2. `chmod 644 certs/certificado.pfx` (não use `600` — quebra a leitura no
   deploy via Docker, onde o container lê o arquivo com um usuário próprio,
   `nextjs`, de UID diferente do dono do arquivo no host).
3. Preencher `FISCAL_CERTIFICADO_SENHA` no `.env` com a senha real do certificado.
4. Reiniciar a aplicação e checar os logs — deve aparecer algo como "Certificado A1
   enviado ao provider fiscal com sucesso". Se aparecer erro, a mensagem já indica o que
   corrigir (arquivo não encontrado, senha incorreta, certificado vencido).
5. Preencher NCM/CFOP/CSOSN/unidade comercial de cada produto que for vendido com nota
   fiscal, em `/admin/produtos`.
6. Emitir uma NFC-e de teste em homologação antes de trocar pra produção.

---

## 24. Checklist de produção

- [ ] `.env` real preenchido (não os placeholders de `.env.production.example`)
- [ ] `JWT_SECRET` e `FISCAL_ENCRYPTION_KEY` gerados com ≥32 caracteres aleatórios
- [ ] `chmod +x scripts/*.sh`
- [ ] Senha do admin trocada (não deixar `12345`)
- [ ] Backup agendado no cron (`scripts/backup.sh`)
- [ ] DNS apontando pro servidor + HTTPS via certbot funcionando
- [ ] `GET /api/health` respondendo `"status":"ok"` publicamente
- [ ] PagBank configurado e testado (sandbox antes de produção)
- [ ] Nuvem Fiscal configurada, certificado A1 instalado e validado no boot
- [ ] NCM/CFOP/CSOSN preenchidos nos produtos que serão vendidos com nota
- [ ] Um pedido de teste completo (site) e uma venda de teste (balcão) conferidos
- [ ] Impressora configurada como padrão no computador que roda o Kanban

---

## 25. Credenciais/segredos necessários (sem valores)

| Segredo | Onde configurar | Gerar com |
|---|---|---|
| Senha do Postgres | `.env` (`DATABASE_URL`) / `docker-compose.yml` env | gerenciador de senhas |
| `JWT_SECRET` | `.env` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `FISCAL_ENCRYPTION_KEY` | `.env` | mesmo comando acima |
| Senha do admin (login) | seed inicial, depois trocar pelo painel | — |
| `NUVEM_FISCAL_CLIENT_ID`/`CLIENT_SECRET` | `.env` | painel da Nuvem Fiscal |
| Senha do certificado A1 (`FISCAL_CERTIFICADO_SENHA`) | `.env` | emitida junto com o certificado (cartório/AC) |
| Client ID / Client Secret / Token do PagBank | painel admin (Configurações → PagBank) | painel do PagBank |
| Senha do e-mail/usuário do cliente B2B | seed inicial (`seedClienteRuteLanches`) | — |

---

## 26. Próximas melhorias sugeridas

Em ordem aproximada de valor/esforço:

1. Preencher NCM/CFOP/CSOSN dos produtos (bloqueador de negócio, não técnico).
2. Verificação de assinatura real no webhook do PagBank, assim que a documentação exata
   estiver em mãos.
3. Recuperação de senha automática (e-mail com token) pro portal do cliente B2B.
4. Separar `JWT_SECRET` do admin e do cliente B2B em duas variáveis.
5. Token de acesso dedicado (não só o cuid) no link `/pedido/[id]`.
6. Se o volume de pedidos crescer muito ou o sistema virar multi-tenant de verdade:
   trocar o rate-limiter em memória por Redis, considerar `prisma.order.aggregate` em
   vez de buscar linhas pra estatísticas.
7. Integração real com impressora térmica (ESC/POS via rede), se o cliente tiver um
   modelo específico e quiser eliminar a dependência do navegador.
8. Upgrade do Prisma para a v7 (major version disponível) — testar com cuidado antes,
   não é urgente.
