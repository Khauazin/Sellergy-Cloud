# Sellergy Cloud — Engine de Workflows (Fase 1 + Fase 2)

> Documentação consolidada do que foi implementado em 2026-04-30 a 2026-05-01.
> Atualizada em 2026-05-01.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack técnica](#3-stack-técnica)
4. [Componentes implementados](#4-componentes-implementados)
   - 4.1. [Schema do banco](#41-schema-do-banco)
   - 4.2. [Engine de execução](#42-engine-de-execução)
   - 4.3. [Filas BullMQ + Worker](#43-filas-bullmq--worker)
   - 4.4. [Triggers (Manual / Webhook / Schedule)](#44-triggers-manual--webhook--schedule)
   - 4.5. [Cifragem de mensagens](#45-cifragem-de-mensagens)
   - 4.6. [Retenção e nível de log](#46-retenção-e-nível-de-log)
   - 4.7. [Logs em tempo real](#47-logs-em-tempo-real)
   - 4.8. [Frontend Builder](#48-frontend-builder)
5. [Decisões arquiteturais e trade-offs](#5-decisões-arquiteturais-e-trade-offs)
6. [Riscos, dívidas técnicas e pontos de revisão](#6-riscos-dívidas-técnicas-e-pontos-de-revisão)
7. [Operação](#7-operação)
8. [Roadmap](#8-roadmap)

---

## 1. Visão geral

O **Sellergy Cloud** ganhou um **engine próprio de workflows estilo n8n** com:

- **Canvas visual drag-and-drop** (React Flow) para montar fluxos
- **5 nós base do MVP**: Manual, IF, SET, CODE (sandbox), HTTP Request (com SSRF blindado)
- **Triggers**: Manual, Webhook (com HMAC), Schedule (cron)
- **Engine assíncrono** com BullMQ + Worker separado (escala horizontal)
- **Mensagens cifradas em repouso** (AES-256-GCM com chave derivada por tenant)
- **Retenção configurável** + truncamento de payloads (proteção contra explosão de banco)
- **Logs em tempo real** via Socket.IO + BullMQ progress events
- **Multi-tenant rígido** em todas as camadas

**Não** foi escolhido embeddar n8n por causa da licença SUL (Sustainable Use License) e necessidade de
ações proprietárias do CRM. Engine próprio dá controle total.

---

## 2. Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                     Cliente (browser)                            │
│  - React + xyflow (canvas)                                       │
│  - socket.io-client (logs ao vivo)                               │
└────────────────┬───────────────────────┬─────────────────────────┘
                 │ HTTP REST             │ WebSocket
                 ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                   backend/src/index.js                           │
│  - Express + Helmet + CORS                                       │
│  - Socket.IO server (rooms execucao:<id>)                        │
│  - QueueEvents listener (escuta worker, re-emite via socket)     │
│  - Rotas builder, execucoes, webhooks, agendamentos, conversas   │
└────────────┬─────────────────────────────────────┬───────────────┘
             │ enqueue                             │ persist
             ▼                                     ▼
┌────────────────────────┐              ┌────────────────────────┐
│   Redis (BullMQ)       │              │   PostgreSQL 16        │
│   - execucao-fluxo     │              │   - schema completo    │
│   - agendamento-disparo│              │   - cascade FKs        │
│   - retencao-execucoes │              │   - índices em hot path│
└────────┬───────────────┘              └────────────────────────┘
         │ consume
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                   backend/src/worker.js                          │
│  - Worker execucao-fluxo (engine + isolated-vm sandbox)          │
│  - Worker agendamento-disparo (cria Execucao + enqueue)          │
│  - Worker retencao-execucoes (job diário 3h UTC)                 │
│  - Reconciliação no boot (agendamentos + retencao)               │
└──────────────────────────────────────────────────────────────────┘
                  │ object storage (mídias)
                  ▼
            ┌──────────────┐
            │  MinIO (S3)  │
            └──────────────┘
```

### Fluxo de uma execução

1. Usuário clica **Executar** no canvas (ou webhook chega ou cron dispara)
2. Backend HTTP cria `Execucao` em status `PENDENTE`
3. Backend faz `filaExecucao.add(...)` com `jobId = execucaoId` (idempotência)
4. Backend retorna 202 com `execucaoId`
5. Frontend abre Drawer e:
   - Faz GET `/execucoes/:id` (estado inicial)
   - Conecta Socket.IO e emite `execucao:subscribe`
   - Em cada `execucao:evento` recebido → refetch
6. Worker pega job, chama `processarExecucao(execucaoId, { onProgresso })`
7. Engine processa nó por nó (DFS partindo do trigger), persistindo `ExecucaoNo`
8. Cada `onProgresso` chama `job.updateProgress(...)`
9. Backend HTTP escuta via `QueueEvents` e re-emite via socket
10. Frontend atualiza UI sem polling

---

## 3. Stack técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20+ |
| Backend HTTP | Express + Helmet + CORS | 4.x |
| Filas | BullMQ + ioredis | 5.x |
| Sandbox JS | isolated-vm | 6.x |
| ORM | Prisma | 5.15 |
| Banco | PostgreSQL | 16 |
| Cache/filas | Redis | 7 |
| Storage | MinIO (S3-compatible) | RELEASE.2025-04-08 |
| Cron | cron-parser v5 | 5.x |
| Realtime | socket.io | 4.x |
| HTTP client | axios | 1.x |
| JWT | jsonwebtoken | 9.x |
| Frontend | React + Vite | 19 / 8 |
| Canvas | @xyflow/react | 12.x |
| Estilo | Tailwind v4 + clsx | 4.x |

---

## 4. Componentes implementados

### 4.1. Schema do banco

Localização: `backend/prisma/schema.prisma`

#### Modelos principais

- **`Fluxo`** — workflow visual; ganhou `nivelLog`, `diasRetencaoSucesso`, `diasRetencaoErro`
- **`No`** — nó do canvas; tipo no enum `TipoNo`
- **`Conexao`** — aresta entre nós; `pontoOrigem` permite saídas múltiplas (IF tem `verdadeiro`/`falso`)
- **`Execucao`** — instância de execução; status, modo, duração, `noTriggerId` opcional
- **`ExecucaoNo`** — historiografia por nó; status, entrada/saída (limitado pelo `nivelLog`)
- **`Webhook`** — 1:1 com nó WEBHOOK; segredo HMAC, exigirHmac, contadores
- **`AgendamentoFluxo`** — 1:1 com nó SCHEDULE; expressão cron, fuso, próximo/último disparo
- **`Conversa`** — agregador de mensagens (canal, lead, ultimaMsgEm) — metadata em CLARO
- **`MensagemConversa`** — conteúdo CIFRADO em BYTEA + IV + tag GCM + versaoChave
- **`AuditoriaMensagem`** — append-only; cada decifragem/criação loga (quem/quando/IP/UA)

#### Enums novos

- `TipoNo`: MANUAL, IF, SET, CODE, HTTP_REQUEST, WEBHOOK, SCHEDULE (+ legados)
- `StatusExecucao`: PENDENTE, EM_EXECUCAO, SUCESSO, ERRO, CANCELADA
- `ModoExecucao`: MANUAL, WEBHOOK, SCHEDULE
- `NivelLog`: NENHUM, METADATA, COMPLETO
- `SentidoMensagem`: ENTRADA, SAIDA
- `AutorMensagem`: BOT, CLIENTE_FINAL, VENDEDOR, SISTEMA
- `TipoMensagem`: TEXTO, IMAGEM, AUDIO, VIDEO, ARQUIVO, LOCALIZACAO, CONTATO, STICKER
- `StatusEntregaMensagem`: PENDENTE, ENVIADA, ENTREGUE, LIDA, ERRO

#### Migrations aplicadas

```
20260430150000_engine_workflows_fase1
20260430160000_webhooks_e_schedule
20260430170000_agendamento_fluxo
20260501100000_conversas_mensagens_retencao
```

### 4.2. Engine de execução

Localização: `backend/src/engine/`

| Arquivo | Responsabilidade |
|---|---|
| `index.js` | `criarExecucaoPendente` + `processarExecucao` + `executarFluxoSincrono` |
| `expressoes.js` | Interpolação `{{caminho.dot}}` (versão simples e profunda) |
| `sandbox.js` | Wrapper isolated-vm: `executarCodigoIsolado` + `avaliarCondicaoIsolada` |
| `registroLog.js` | `aplicarPolitica` (NENHUM/METADATA/COMPLETO + truncamento 8KB) |
| `executores/manual.js` | Trigger Manual — propaga `dadosGatilho` |
| `executores/set.js` | Define variáveis no contexto (suporta interpolação) |
| `executores/if.js` | Avalia expressão num isolate, retorna `proximaSaida` |
| `executores/code.js` | Executa JS user em isolate (128MB / 10s) |
| `executores/httpRequest.js` | HTTP com SSRF blindado |

**Limites:**
- Max 1000 passos por execução
- isolated-vm: 128MB memória, 10s timeout
- HTTP: 1s–120s timeout, 5MB resposta, maxRedirects=0
- Truncamento payload: 8KB (acima vira hash + sumário)

### 4.3. Filas BullMQ + Worker

Localização: `backend/src/filas/index.js` + `backend/src/worker.js`

3 queues:

| Queue | Job name | Concorrência | Função |
|---|---|---|---|
| `execucao-fluxo` | `executar` | configurável (`WORKER_CONCORRENCIA=5`) | Processa execuções |
| `agendamento-disparo` | `disparar` | 2 | Cron repeatable jobs |
| `retencao-execucoes` | `limpar` | 1 | Job diário 3h UTC |

**Idempotência:**
- `enfileirarExecucao` usa `jobId: execucaoId` → mesmo ID não enfileira 2x
- `adicionarRepeatableAgendamento` usa `jobId: agendamento:<id>` → idem

**Retry/backoff:**
- Execução: 3 tentativas, exponential 2s
- Retenção: 2 tentativas, fixed 30s
- Agendamento: 1 tentativa (disparo é "fire and forget")

**Reconciliação no boot do worker:**
- Reagenda todos os agendamentos ativos do banco (delay 2s)
- Garante o job de retenção diário (`0 3 * * *` UTC)

### 4.4. Triggers (Manual / Webhook / Schedule)

#### Manual
- Botão **Executar** no Builder
- POST `/execucoes/fluxo/:fluxoId` cria Execucao + enfileira
- Aceita `dadosGatilho` no body (max 50KB)

#### Webhook
- Localização: `backend/src/routes/webhooks-publico.routes.js`
- Rota PUBLIC: `POST /webhooks/:webhookId` (sem auth JWT)
- Proteção primária: `webhookId` opaco (UUID v4)
- Proteção opcional: HMAC SHA-256 sobre o byte-stream original
  - Header: `X-Webhook-Signature: sha256=<hex>`
  - Comparação `crypto.timingSafeEqual` (anti timing attack)
  - Quando `exigirHmac=true`, recusa sem assinatura ou inválida (401)
- Rate limit: 60 req/min por IP (`express-rate-limit`)
- `express.raw` registrado ANTES do `express.json` global (preserva bytes pra HMAC)
- CRUD admin: `backend/src/routes/webhooks-admin.routes.js`

#### Schedule
- Helper: `backend/src/agendamento.js`
- Validação: `cron-parser` (suporta v5 `CronExpressionParser.parse` e v4 `parseExpression`)
- BullMQ Repeatable Jobs com `repeat.pattern` + `repeat.tz`
- CRUD admin: `backend/src/routes/agendamentos-admin.routes.js`
- Atualiza `proximoDisparoEm` automaticamente

### 4.5. Cifragem de mensagens

Localização: `backend/src/cripto/cofreMensagens.js`

#### Esquema de chaves

```
masterKey (env MENSAGENS_MASTER_KEY, 32 bytes base64)
   │
   │ HKDF-SHA256(salt='sellergy-mensagens-v1', info=clienteId, len=32)
   ▼
chaveTenant (32 bytes, exclusiva por cliente)
   │
   │ AES-256-GCM com IV aleatório 12B + tag 16B
   ▼
{ conteudoCifrado, iv, tag, versaoChave }  →  BYTEA no banco
```

#### Garantias de segurança hoje

- ✅ Cifrado em repouso (DBA com `SELECT *` vê só BYTEA)
- ✅ Tenant isolation (chave derivada por `clienteId` — B não decifra A)
- ✅ Tampering detectado pelo GCM auth tag
- ✅ ADMIN do sistema **não** decifra via API (middleware bloqueia)
- ✅ Toda decifragem audita em `auditoria_mensagens`
- ✅ Backup do DB vaza ciphertext, não plaintext

#### Limitações conhecidas

- ❌ ADMIN com SSH no servidor + acesso ao código + master key consegue descriptografar offline
- ❌ Sem rotação de chave automatizada (`versaoChave` está pronto pra isso, mas falta lógica)
- ❌ Master key não está em KMS/Vault (em texto puro no `.env`)

#### Política de acesso

`backend/src/middlewares/mensagens.middleware.js`:

- `requerAcessoConteudoMensagem`: bloqueia perfil `ADMIN` global. Apenas tenant member (`CLIENT`/`ADMINISTRADOR`/`VENDEDOR`) decifra
- `pertenceAoTenantDoUsuario(usuario, clienteIdRecurso)`: dupla verificação
- `auditarLeitura`/`auditarCriacao`: persistem em `auditoria_mensagens` async (não bloqueia resposta)

#### Rotas

`backend/src/routes/conversas.routes.js`:

- `GET /conversas` — lista metadata (paginação cursor)
- `GET /conversas/:id` — metadata
- `POST /conversas` — só tenant member
- `GET /conversas/:id/mensagens` — default sem conteúdo; `?incluirConteudo=true` valida tenant + decifra + audita
- `POST /conversas/:id/mensagens` — cifra antes de salvar, audita criação

ADMIN do sistema sempre recebe `conteudo: null, cifrado: true`, mesmo com `?incluirConteudo=true`.

### 4.6. Retenção e nível de log

Localização: `backend/src/engine/registroLog.js` + `backend/src/retencao.js`

#### `nivelLog` (configurável por fluxo, default `METADATA`)

| Nível | Comportamento |
|---|---|
| `NENHUM` | Não salva entrada/saída (só status/duracao) |
| `METADATA` | Sumário (chaves topo + tamanho + hash) |
| `COMPLETO` | Payload truncado a 8KB |

**Erros sempre forçam `COMPLETO`** (preserva contexto de debug).

#### Retenção (default 30d sucesso / 90d erro, configurável por fluxo)

- Job diário às 3h UTC via BullMQ Repeatable
- `aplicarRetencaoExecucoes` itera fluxos, deleta `Execucao` por status:
  - `SUCESSO` mais antigas que `diasRetencaoSucesso`
  - `ERRO`/`CANCELADA` mais antigas que `diasRetencaoErro`
- Lotes de 500 (evita lock longo no DB)
- Cascade FK limpa `execucoes_nos` automaticamente

### 4.7. Logs em tempo real

#### Backend (worker → backend HTTP → frontend)

- Engine `processarExecucao(execucaoId, { onProgresso })` aceita callback
- Worker passa `(evento) => job.updateProgress(evento)`
- Backend HTTP usa `QueueEvents`:
  - `progress` → `io.to('execucao:'+jobId).emit('execucao:evento', data)`
  - `completed`/`failed` → `execucao:fim`
- **Pelo socket trafegam APENAS metadados** (status, IDs, duração) — payload sensível só pelo REST

#### Frontend (`DrawerExecucao.jsx`)

- Conecta socket.io com auth via `@sellergy:token`
- Emite `execucao:subscribe` ao abrir
- Em cada evento socket → refetch GET `/execucoes/:id`
- Fallback de **5s** se socket cair (refetch periódico até status final)
- Indicador visual "ao vivo" (ponto verde Radio) no título quando conectado
- Cleanup limpa subscribe + disconnect ao fechar

### 4.8. Frontend Builder

Localização: `frontend/src/components/Builder/` + `frontend/src/pages/BuilderPage.jsx`

| Arquivo | Responsabilidade |
|---|---|
| `catalogoNos.js` | Config dos 7 tipos (rótulo, ícone, cor, handles, dadosPadrao) |
| `utilCanvas.js` | Conversão API ↔ React Flow + geradores de ID |
| `nos/NoBase.jsx` | Card visual único, adapta handles e cor pelo `data.tipo` |
| `PaletaNos.jsx` | Drag-source dos 7 tipos |
| `PainelPropriedades.jsx` | Forms dinâmicos por tipo (HTTP, IF, SET, CODE, MANUAL, WEBHOOK, SCHEDULE) |
| `CanvasFluxo.jsx` | Wrapper @xyflow/react v12 com Provider + drag-drop |
| `DrawerExecucao.jsx` | Logs com socket.io + refetch + accordion |

`BuilderPage.jsx` orquestra: header (Select de fluxo + Switch Ativo + Salvar/Executar/Excluir), grid 3-col (paleta | canvas | painel), Drawer de novo fluxo, confirmação ao trocar fluxo sujo.

---

## 5. Decisões arquiteturais e trade-offs

### 5.1. Engine síncrono → assíncrono em sub-fases

**Sub-fase 1.3** entregou engine **síncrono** dentro do request HTTP. **Sub-fase 2.1** refatorou pra
`criarExecucaoPendente` + `processarExecucao` separados, permitindo enqueue. O wrapper
`executarFluxoSincrono` ainda existe pra testes.

**Trade-off:** complexidade extra (precisa Redis + worker process), mas escala horizontal e isola
falhas do engine do request HTTP.

### 5.2. Master key no servidor (sem CMEK)

A cifragem usa master key em env, derivando por tenant via HKDF. Isso protege contra **acesso ao DB**
mas não contra **acesso ao código + servidor**.

**Decisão:** aceitável pra MVP/Beta. Para produção em vertical regulada (saúde, financeiro), trocar
por CMEK (cliente fornece a chave) + KMS/HSM.

### 5.3. Multi-tenant via `clienteId` shared schema

Todo modelo "tenant data" tem `clienteId`; todo lookup filtra por ele se não for ADMIN. Sem RLS
do Postgres por enquanto.

**Trade-off:** RLS seria rede de segurança extra contra bug de aplicação. Sem ele, um `findMany`
sem filtro pode vazar entre tenants — mas o code review rigoroso e o middleware mitigam.

### 5.4. Logs em tempo real só com metadados

Socket.IO emite `{ tipo, execucaoId, noId, status, duracaoMs }` — sem entrada/saída. Detalhes
exigem GET `/execucoes/:id` (que valida tenant via REST).

**Trade-off:** mais round-trips, mas elimina necessidade de validação de ownership no socket
(que seria mais um vetor de bug).

### 5.5. Truncamento + retenção em vez de logs externos

Logs ficam no Postgres em vez de ir pra OpenSearch/ClickHouse. Mais simples no MVP, mas:
- Postgres com JSONB grande não é ideal pra TB de log
- Retenção limita explosão, mas pode bloquear writes em DELETEs grandes

**Trade-off:** OK até alguns milhões de execuções/dia. Acima disso, extrair pra storage especializado.

### 5.6. SSRF blindado em duas camadas

`backend/src/engine/executores/httpRequest.js`:
1. **Pré-request**: se `parsed.hostname` é IP literal, valida ranges privados sincronamente
2. **DNS**: `http.Agent`/`https.Agent` com `lookup` customizado que valida o IP resolvido

**Por quê duas camadas?** Camada 1 cobre IPs literais (onde `dns.lookup` nem é chamado). Camada
2 cobre hostnames que resolvem para IPs internos. Sem TOCTOU.

Bloqueia: `127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16` (cloud metadata!), `0/8`,
`100.64/10`, `198.18/15`, multicast, **todo IPv6**.

### 5.7. Storage keys com prefixo `@sellergy:`

LocalStorage namespacing previne colisão com outros apps no mesmo domínio. Trocar o prefixo
desloga todos os usuários — feito intencionalmente no rebrand.

---

## 6. Riscos, dívidas técnicas e pontos de revisão

> Esta é a seção que **vai amadurecer com o tempo**. Cada item tem nível de severidade
> sugerido (🔴 alto, 🟡 médio, 🟢 baixo).

### Segurança

| # | Item | Severidade | Onde | Notas |
|---|---|---|---|---|
| S1 | **Master key em `.env` puro** | 🔴 | `backend/.env` | Em produção mover pra KMS/Vault. Quem tiver SSH consegue descriptografar tudo offline. |
| S2 | **`JWT_SECRET` em `.env` puro** | 🔴 | `backend/.env` | Mesmo problema. |
| S3 | **CMEK não implementado** | 🟡 | `cripto/cofreMensagens.js` | `versaoChave` permite, mas falta UI/fluxo. Necessário pra mercado regulado. |
| S4 | **Socket.IO sem validação de tenant no subscribe** | 🟡 | `backend/src/index.js` | Hoje qualquer socket autenticado pode dar `subscribe` em qualquer execucaoId. Mitigado pela emissão só de metadados, mas vulnerável a enumeração de IDs. |
| S5 | **`@sellergy:token` em localStorage** | 🟡 | `frontend/src/store/auth.store.js` | Vulnerável a XSS. Migrar pra httpOnly cookie em produção. |
| S6 | **CORS aberto pra localhost por default** | 🟡 | `backend/src/index.js` | `CORS_ORIGINS` precisa ser definido em produção. |
| S7 | **Webhook público sem captcha/rate adicional** | 🟡 | `webhooks-publico.routes.js` | Tem rate limit por IP (60/min) mas atacante distribuído ou amigo do alvo pode abusar. |
| S8 | **Sem rotação automática de segredos de webhook** | 🟢 | `webhooks-admin.routes.js` | Endpoint manual existe; falta política. |
| S9 | **Audit log de mensagens cresce sem limite** | 🟡 | `auditoria_mensagens` | Sem TTL. Em volume alto vai inchar. Adicionar partição por mês ou job de retenção. |
| S10 | **Sem 2FA pra ADMIN do sistema** | 🟡 | `auth.routes.js` (preexistente) | Conta com mais privilégios é a menos protegida. |

### Engine / Performance

| # | Item | Severidade | Onde | Notas |
|---|---|---|---|---|
| E1 | **Engine recursivo (DFS) sem limite de stack** | 🟡 | `engine/index.js` | Limite de 1000 passos protege, mas Node estoura stack antes em fluxos profundos. Refatorar pra iterativo se virar problema. |
| E2 | **isolated-vm em Windows requer Build Tools** | 🟢 | dev only | Em prod (Docker Linux) tudo bem. Doc abaixo. |
| E3 | **Code node sem APIs úteis injetadas** | 🟢 | `engine/sandbox.js` | Hoje só `entrada`/`variaveis`. Adicionar utils (lodash-like, fetch via proxy, etc.) sob demanda. |
| E4 | **HTTP node sem cache** | 🟢 | `executores/httpRequest.js` | Toda chamada vai pra rede. Adicionar Redis cache opt-in se virar gargalo. |
| E5 | **Sem retry granular por nó** | 🟡 | `engine/index.js` | Erro num nó falha a Execucao toda. Considerar `retry`/`onError` por nó (config no `dados`). |
| E6 | **DELETE em retenção pode lockar** | 🟡 | `retencao.js` | Lotes de 500 ajudam mas em milhões pode bloquear. Considerar `pg_partman` ou particionamento manual. |
| E7 | **Polling fallback de 5s no Drawer aumenta carga** | 🟢 | `DrawerExecucao.jsx` | Se socket cair com muitos drawers abertos, viraria N×req/5s. OK pra escala atual. |

### Frontend

| # | Item | Severidade | Onde | Notas |
|---|---|---|---|---|
| F1 | **Bundle de 800KB sem code splitting** | 🟡 | `vite build` warning | Importações pesadas (xyflow, recharts, dnd). Aplicar dynamic imports nas páginas. |
| F2 | **61 lint errors preexistentes** | 🟡 | várias páginas | Padrão `carregar` antes de declarar + `set-state-in-effect`. Não foram introduzidos pelas novas implementações. |
| F3 | **Sem testes automatizados** | 🟡 | tudo | Só smoke tests manuais. Vitest seria mínimo. |
| F4 | **`set-state-in-effect` desabilitado em Builder/Drawer** | 🟢 | comments inline | Justificado (fetch-on-mount), mas a lógica certa seria TanStack Query / SWR. |
| F5 | **UI tenant-side de mensagens NÃO existe** | 🟡 | `/app/mensagens` é placeholder | Backend pronto. Cancelado por escopo. Quando criar, lembrar policy de admin (não pode ler). |

### Banco / Migrations

| # | Item | Severidade | Onde | Notas |
|---|---|---|---|---|
| B1 | **Migrations precisam ser aplicadas após pull** | 🟢 | `prisma migrate deploy` | Documentar em CI/CD. |
| B2 | **Sem soft-delete em nada** | 🟢 | Prisma `onDelete: Cascade` | Excluir Cliente apaga TUDO. Em produção, considerar `desativadoEm` no Cliente em vez de DELETE. |
| B3 | **Sem backup automatizado** | 🔴 | infra | Postgres sem snapshot agendado. Adicionar `pg_dump` diário pro MinIO. |
| B4 | **Sem pgcrypto/pgvector ainda** | 🟢 | schema | Esperado pra Fase 3 (IA com vector store). |

### Infra / Deploy

| # | Item | Severidade | Onde | Notas |
|---|---|---|---|---|
| I1 | **`.env` rastreado no `.gitignore`** | 🟢 | OK | Mas precisa documentar `.env.example` (TODO). |
| I2 | **`COMPOSE_PROJECT_NAME` mudou de `botmanager` pra `sellergy`** | 🟢 | docker-compose | Volumes antigos órfãos. Limpos no fresh start de 2026-05-01. |
| I3 | **Sem reverse proxy / TLS** | 🔴 | nada configurado | Em produção precisa Traefik/nginx + Let's Encrypt. |
| I4 | **Sem observabilidade** | 🟡 | console.log | Adicionar Pino + structured logs + OpenTelemetry. |
| I5 | **MinIO root credentials no `.env`** | 🟡 | mesmo problema dos outros segredos | KMS/Vault em produção. |
| I6 | **Workers compartilham memória do processo** | 🟢 | `worker.js` | Concorrência alta pode estourar memória se muitos isolated-vm simultâneos. Cada isolate = 128MB de limite, mas alocação real é lazy. |
| I7 | **Job de retenção depende de worker estar de pé** | 🟢 | `worker.js` reconcilia no boot | Se worker fica offline >24h, a retenção atrasa. BullMQ Repeatable cobre na próxima janela. |

### Operação

| # | Item | Severidade | Onde | Notas |
|---|---|---|---|---|
| O1 | **Trocar `MENSAGENS_MASTER_KEY` invalida toda mensagem cifrada** | 🔴 | `cripto/cofreMensagens.js` | Comentário no `.env`. Sem rotação implementada. |
| O2 | **Renomear cliente NÃO regera chave de tenant** | 🟡 | HKDF usa `clienteId` (UUID estável) | OK. Mas se UUID mudar, perde acesso. |
| O3 | **MinIO Access Keys passaram pelo chat de IA** | 🟡 | conv. inicial | Recomendado regenerar no console e atualizar `.env`. |

---

## 7. Operação

### 7.1. Subir o ambiente (dev)

```powershell
cd C:\Users\USER\Desktop\bot\botmanager

# 1) Infra
docker compose up -d postgres redis minio

# 2) Migrations + cliente Prisma
cd backend
npx prisma migrate deploy
npx prisma generate

# 3) Seed (cria admin@sellergy.cloud / admin123)
npx prisma db seed

# 4) Subir backend, worker e frontend (3 terminais)
# Terminal 1
cd backend ; npm run dev

# Terminal 2
cd backend ; npm run worker:dev

# Terminal 3
cd frontend ; npm run dev
```

Acessos:
- App: http://localhost:5173
- API: http://localhost:3333
- MinIO console: http://localhost:9001
- pgAdmin: http://localhost:8080

### 7.2. Subir o ambiente (prod, tudo em Docker)

```bash
docker compose up -d
docker compose up -d --scale worker=3   # escalar workers
```

### 7.3. Variáveis de ambiente importantes

```env
# Banco
DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
DATABASE_URL  # construída automaticamente em prod

# Auth
JWT_SECRET                    # gerar via `openssl rand -base64 64`

# Filas
REDIS_URL                     # redis://localhost:6379 dev / redis://redis:6379 prod
WORKER_CONCORRENCIA           # default 5

# Storage
MINIO_ENDPOINT
MINIO_ACCESS_KEY              # criar no console MinIO; nunca usar root
MINIO_SECRET_KEY
MINIO_BUCKET_MIDIA            # sellergy-midia
MINIO_USE_SSL                 # true em prod com TLS

# Cifragem
MENSAGENS_MASTER_KEY          # 32 bytes base64; trocar invalida tudo

# Compose
COMPOSE_PROJECT_NAME          # sellergy
```

### 7.4. Troubleshoot

#### `npm install` do backend falha em Windows
- Causa: `isolated-vm` é addon nativo
- Solução A: instalar Visual Studio Build Tools
- Solução B: rodar backend em WSL2
- Solução C: subir backend em container

#### Worker não pega jobs
- Conferir Redis está acessível: `docker compose logs redis`
- Conferir `REDIS_URL` no `.env`
- Logs: `docker compose logs worker -f`

#### Webhook responde 401 sem header
- Webhook tem `exigirHmac=true`. Ou desliga via PATCH `/webhooks-admin/:id`, ou manda assinatura HMAC

#### Drawer não atualiza ao vivo
- Conferir badge "ao vivo" no título — se ausente, socket caiu
- Polling fallback de 5s ainda funciona mesmo sem socket
- Logs do navegador: erro em `connect_error`?

#### Migrations divergentes
- `npx prisma migrate status`
- Em dev, `npx prisma migrate reset` apaga TUDO (cuidado)

---

## 8. Roadmap

### Concluído
- ✅ Fase 1.1 — schema engine + builder PT-BR + execucoes
- ✅ Fase 1.2 — canvas React Flow + 5 nós base
- ✅ Fase 1.3 — engine síncrono + isolated-vm + SSRF blindado
- ✅ Fase 2.1 — BullMQ + Worker separado + execução assíncrona
- ✅ Fase 2.2 — Webhook trigger + HMAC + rate limit
- ✅ Fase 2.3 — Schedule trigger + cron com BullMQ Repeatable
- ✅ Fase 2.4 — Cifragem mensagens + retenção + logs em tempo real

### Pendente
- ⏳ Fase 2.5 — Sistema de credenciais cifradas (HTTP node usa)
- ⏳ Fase 3 — Nós CRM proprietários, AI Agent + vector store, integração WhatsApp/Telegram
- ⏳ Fase 4 — Sub-workflows, error workflows, retry granular, versionamento, Git sync, evaluations IA, MCP

### Trabalho transversal sugerido (a qualquer momento)
- 📋 Testes automatizados (Vitest + Testcontainers)
- 📋 Observabilidade (Pino + OpenTelemetry + Prometheus)
- 📋 Backup automatizado (pg_dump → MinIO)
- 📋 Reverse proxy + TLS (Traefik + Let's Encrypt)
- 📋 KMS/Vault para segredos
- 📋 RLS Postgres como rede de segurança extra
- 📋 UI tenant-side de mensagens (Inbox)
- 📋 Limpeza dos lint errors preexistentes (61 erros)
- 📋 Code splitting do frontend (bundle 800KB → <500KB por chunk)

---

## Apêndice A — Referência rápida de endpoints

### Builder
- `GET /builder/fluxos/:botId` — lista fluxos do bot
- `GET /builder/fluxos/:fluxoId/canvas` — nós + conexões
- `POST /builder/fluxos` — criar
- `PUT /builder/fluxos/:id` — atualizar metadados
- `PUT /builder/fluxos/:fluxoId/canvas` — salvar canvas (idempotente, transação)
- `DELETE /builder/fluxos/:id`

### Execuções
- `POST /execucoes/fluxo/:fluxoId` — disparar manual (retorna 202 + execucaoId)
- `GET /execucoes/fluxo/:fluxoId?limite=20&cursor=<id>` — lista
- `GET /execucoes/:id` — detalhes com nós

### Webhooks (admin, autenticado)
- `GET /webhooks-admin/fluxo/:fluxoId`
- `GET /webhooks-admin/no/:noId`
- `POST /webhooks-admin/fluxo/:fluxoId` body `{ noId, descricao?, exigirHmac? }`
- `PATCH /webhooks-admin/:id`
- `POST /webhooks-admin/:id/regenerar-segredo`
- `DELETE /webhooks-admin/:id`

### Webhook receiver (público)
- `POST /webhooks/:webhookId` — body livre; opcional `X-Webhook-Signature: sha256=<hex>`

### Agendamentos
- `GET /agendamentos-admin/fluxo/:fluxoId`
- `GET /agendamentos-admin/no/:noId`
- `POST /agendamentos-admin/fluxo/:fluxoId` body `{ noId, expressaoCron, fusoHorario? }`
- `PATCH /agendamentos-admin/:id`
- `DELETE /agendamentos-admin/:id`

### Conversas / Mensagens
- `GET /conversas` — lista metadata (multi-tenant)
- `GET /conversas/:id`
- `POST /conversas` — só tenant member
- `GET /conversas/:id/mensagens` — sem conteúdo
- `GET /conversas/:id/mensagens?incluirConteudo=true` — bloqueia ADMIN do sistema
- `POST /conversas/:id/mensagens` — cifra + audita

### Socket.IO eventos
- Cliente → servidor: `execucao:subscribe { execucaoId }`, `execucao:unsubscribe`
- Servidor → cliente (room `execucao:<id>`): `execucao:evento`, `execucao:fim`

---

## Apêndice B — Decisões "para revisar antes de produção"

- [ ] Mover `MENSAGENS_MASTER_KEY` e `JWT_SECRET` pra KMS/Vault
- [ ] Implementar CMEK (cliente fornece chave) ou justificar não fazer
- [ ] Validar tenant no Socket.IO `execucao:subscribe`
- [ ] Trocar `localStorage` por `httpOnly cookie` para o JWT
- [ ] Definir `CORS_ORIGINS` explicitamente
- [ ] Adicionar 2FA para ADMIN do sistema
- [ ] Política de retenção de `auditoria_mensagens`
- [ ] Backup automatizado do Postgres
- [ ] Reverse proxy + TLS
- [ ] Observabilidade (logs estruturados + métricas)
- [ ] Testes automatizados (Vitest + Testcontainers)
- [ ] Code splitting do frontend
- [ ] Considerar RLS no Postgres
- [ ] Regenerar credenciais MinIO que passaram pelo chat
