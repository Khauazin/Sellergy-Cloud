# Orquestração — 6 Claudes em paralelo (rebuild ERP-first)

> Como dividir o rebuild do pivô (ver [`plano-de-acao-pivo.md`](plano-de-acao-pivo.md))
> entre **6 instâncias do Claude Code** rodando no terminal, **sem colisão**.
> Cada Claude abre este doc, acha sua frente e trabalha **só nos arquivos dela**, **na sua branch**.
> Criado em 2026-06-19.

---

## Regras de ouro (leia antes de codar)

1. **Cada frente na sua branch.** Nunca duas frentes na mesma branch. Sugestão de worktree:
   `git worktree add ../bot-<frente> pivo/<frente>` (isola o working dir de verdade).
2. **Só a Frente 1 edita `backend/prisma/schema.prisma` e roda `prisma migrate`.** Migration
   é ponto de serialização — duas em paralelo = conflito garantido. As outras frentes
   **consomem** os models que a Frente 1 já criou; se faltar campo, **pedem pra Frente 1**.
3. **Costuras compartilhadas são pré-semeadas pela Frente 1**: pontos de `app.use(...)` em
   `index.js`, rotas em `App.jsx`, itens de menu no `ClientLayout`, e **páginas-casca vazias**.
   As frentes só **preenchem** o arquivo da sua página/rota — não brigam pela costura.
4. **Ordem:** Frente 1 vai **primeiro** (curta e focada: models + seams + base da Fase 2).
   Quando os models e as cascas existirem, **2/3/4/5 disparam em paralelo**. A Frente 6
   (revisor) roda o tempo todo, em cima das branches das outras.
5. **`security-guidance`** é hook — fica ativo em todas automaticamente. **`frontend-design`**
   é guia de UI: as frentes 2/3/4/5 usam ao construir a tela delas.
6. Antes de cada PR: `node --check`, lint, smoke do módulo. A Frente 6 confirma.

---

## Mapa das frentes

| # | Frente | Plugin principal | Branch | Depende de |
|---|---|---|---|---|
| 1 | **Fundação (Fase 2 + schema/models/seams)** | `feature-dev` | `pivo/f2-fundacao` | — (vai 1º) |
| 2 | **Pagamentos** (3 PSP) | `feature-dev` + `frontend-design` | `pivo/pagamentos` | 1 (models Cobranca/ConfigPagamento) |
| 3 | **Fiscal** (NFC-e/NFS-e) | `feature-dev` + `frontend-design` | `pivo/fiscal` | 1 (DocumentoFiscal/ConfigFiscal) |
| 4 | **Bot WhatsApp** (casca, sem IA) | `feature-dev` + `frontend-design` | `pivo/bot-whatsapp` | 1 (Bot reduzido + Faq) |
| 5 | **Usuários & Equipe** (unificada) | `feature-dev` + `frontend-design` | `pivo/usuarios` | 1 (segmento generalizado) |
| 6 | **QA / Revisor** | `code-review` + `pr-review-toolkit` | — (revisa as branches) | todas |

---

## Frente 1 — Fundação · `feature-dev` · branch `pivo/f2-fundacao`
**Objetivo:** destravar todo mundo. É curta mas é pré-requisito.
**Faz (Fase 2 + seams):**
- `backend/prisma/schema.prisma` (**dona exclusiva**) + migrations:
  - `pivo_credenciais_tipos`: enum `TipoCredencial` — tira IA, adiciona
    `MERCADO_PAGO_KEY, ASAAS_KEY, PAGARME_KEY, FOCUS_NFE_KEY, NUVEM_FISCAL_KEY`.
  - `pivo_pagamento_fiscal`: cria `Cobranca`, `ConfiguracaoPagamento`, `DocumentoFiscal`,
    `ConfiguracaoFiscal`, `Faq` (simples) + reduz model `Bot` (só conexão).
- `backend/src/constants/modulosSegmento.js`: generaliza p/ gatear **tipos de usuário** e a
  **matriz módulos×ações** por segmento (base do gating das Frentes 4/5).
- Revisar permissões/escopo para os módulos novos (Pagamentos/Fiscal).
- **Pré-semear costuras** (stubs vazios, pra ninguém colidir depois):
  - `index.js`: `app.use('/api/pagamentos', ...)`, `/api/fiscal`, webhooks (stubs).
  - `App.jsx`: rotas `/app/pagamentos`, `/app/fiscal`, `/app/bot`, `/app/usuarios`.
  - `ClientLayout`: itens de menu (gating por segmento).
  - Páginas-casca vazias: `PagamentosPage.jsx`, `FiscalPage.jsx` (Bot/Usuários já existem).
**NÃO mexe em:** adapters, lógica de cada vertical (é das frentes 2–5).

## Frente 2 — Pagamentos · `feature-dev` · branch `pivo/pagamentos`
**Dona dos arquivos:**
- `backend/src/adapters/pagamento/` (novo): interface `ProvedorPagamento` +
  `MercadoPagoAdapter`, `AsaasAdapter`, `PagarmeAdapter`.
- `backend/src/routes/pagamentos.routes.js` (novo) + handler de webhook
  `POST /webhooks/pagamento/:provedor` (idempotente por `provedorCobrancaId`).
- Efeito de confirmação (baixa venda/agendamento + lançamento PAGO) + job de conciliação.
- `frontend/src/pages/PagamentosPage.jsx` (preenche a casca da Frente 1).
**Consome:** models `Cobranca`, `ConfiguracaoPagamento` (Frente 1). Ref: `erp-arquitetura §4`.

## Frente 3 — Fiscal · `feature-dev` · branch `pivo/fiscal`
**Dona dos arquivos:**
- `backend/src/adapters/fiscal/` (novo): interface `ProvedorFiscal` + `FocusNFeAdapter`,
  `NuvemFiscalAdapter`.
- `backend/src/routes/fiscal.routes.js` (novo) + job de **emissão assíncrona** (fila) de
  NFC-e/NFS-e com estados + retry (em `backend/src/jobs/`).
- `frontend/src/pages/FiscalPage.jsx`.
**Consome:** models `DocumentoFiscal`, `ConfiguracaoFiscal` (Frente 1). Ref: `erp-arquitetura §5`.

## Frente 4 — Bot WhatsApp · `feature-dev` · branch `pivo/bot-whatsapp`
**Dona dos arquivos:**
- `backend/src/routes/bots.routes.js` (limpa do que era IA → casca de conexão).
- Webhook `POST /webhooks/whatsapp` + **roteador de menu fixo** (estado por conversa, sem IA).
- Atendimento básico via **FAQ simples** (model `Faq`) + agendamento por menu (reaproveita
  `agenda.listarHorariosLivres`) + campanhas (reaproveita fila de recompra de `campanhas.routes.js`).
- `frontend/src/pages/BotsPage.jsx` / `BotCanalPage.jsx` / `BotSettingsPage.jsx` (reduz à casca).
**Consome:** model `Bot` reduzido + `Faq` (Frente 1). Ref: `erp-arquitetura §6`. *(Embedded
Signup real = Fase 4 / depende da Meta; aqui monta a tela e o webhook.)*

## Frente 5 — Usuários & Equipe · `feature-dev` · branch `pivo/usuarios`
**Dona dos arquivos:**
- `backend/src/routes/usuarios.routes.js`: criação unificada; quando tipo=Especialista,
  cria `Usuario` + `Especialista` em transação; gating por segmento (tipos + módulos×ações).
- Migra a lógica útil de `especialistas.routes.js` pra cá e **apaga** `EspecialistasPage.jsx`.
- `frontend/src/pages/UsersPage.jsx` / `CrmUsersPage.jsx` (tela unificada + matriz de permissões).
**Consome:** `modulosSegmento.js` generalizado (Frente 1). Ref: `erp-arquitetura §2.5`, `telas §13`.

## Frente 6 — QA / Revisor · `code-review` + `pr-review-toolkit` · sem branch própria
**Não escreve feature** (zero colisão). A cada branch que avança:
- Roda `/code-review` (scoring de confiança) e os agentes do `pr-review-toolkit`
  (silent-failure-hunter, type-design, test-analyzer, simplifier).
- Verifica o que os docs exigem: **multi-tenant** (`clienteId` em toda query, sem IDOR),
  **LGPD/cifra** de credenciais, **idempotência** de webhook, validação de entrada.
- Roda smokes (`node --check`, backend sobe, front builda) antes de cada merge.

---

## Sequência prática
1. **Frente 1** abre a branch, lança models + seams + base da Fase 2, faz PR. As demais
   **rebasam** nessa base assim que os models existirem.
2. **2/3/4/5** disparam em paralelo (cada uma na sua branch/worktree, arquivos isolados).
3. **6** revisa contínuo; merges entram um de cada vez na `main` do `botmanager` após review.
```
