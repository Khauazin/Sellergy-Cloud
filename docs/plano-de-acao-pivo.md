# Plano de Ação do Pivô — ERP de Gestão (lojas + clínicas)

> **Documento de execução** do pivô `chatbot-first → ERP-first`. Costura
> [`erp-pivo.md`](erp-pivo.md) (decisões) e [`erp-arquitetura-e-operacao.md`](erp-arquitetura-e-operacao.md)
> (operação/infra) numa **sequência executável**. Ordem definida pelo dono:
> **1) apagar o desnecessário → 2) adaptar o ERP existente → 3) novas telas/funções →
> 4) integrações.** Criado em 2026-06-19. **Desenvolvimento só começa após a documentação
> estar completa e aprovada.**

---

## Convenções
- Cada item tem **status**: ⬜ a fazer · ✅ feito · 🔵 depois (fase posterior).
- **Migração** marcada onde o passo mexe no schema (você roda no host:
  `cd backend; npx prisma migrate dev --name <nome>`).
- **Dependência** indica o que precisa vir antes.

---

## Fase 1 — Apagar tudo o que é desnecessário (a camada de IA/bot complexo)

**Objetivo:** remover o que ficou para trás no pivô, deixando o repositório só com o ERP
+ a casca de bot a ser remontada. Ver lista completa em `erp-pivo.md` §5.

### 1.1 Backend — remover arquivos/módulos
- ⬜ Agente de IA: `src/engine/executores/aiAgent.js` + o registro do nó `AI_AGENT` no engine.
- ⬜ Tools do agente: `src/agente/tools/*` (todas) + `src/agente/executor.js` + `src/agente/presets.js`.
- ⬜ Credencial de IA de plataforma: `src/routes/admin-ia.routes.js` + desmontar `/admin/ia` no `index.js`;
  remover `carregarCredencialPlataformaPorTipo` e `CLIENTE_ID_PLATAFORMA` de `src/credenciais.js`.
- ⬜ Builder de fluxo: `src/routes/builder.routes.js` + desmontar no `index.js`.
- ⬜ Inbox: `src/routes/conversas.routes.js` + desmontar no `index.js`.
- ⬜ Sandbox: remover dependência/uso de `isolated-vm`.

### 1.2 Frontend — remover telas/rotas
- ⬜ `pages/AdminIaPage.jsx` · `pages/BotConfigPage.jsx` · `pages/BotToolsPage.jsx` ·
  `pages/MensagensPage.jsx` · `pages/BuilderPage.jsx` · `components/Builder/*`.
- ⬜ Remover as rotas correspondentes no `App.jsx` e os itens de menu (`AdminLayout`/`ClientLayout`):
  `/admin/ia`, `/admin/bots/:id/config`, `/admin/bots/:id/tools`, `/admin/builder/:id`, `/app/mensagens`.
- ⚠️ `EspecialistasPage.jsx` **só sai na Fase 3** (depois que Usuários absorver o especialista).
  Não apagar agora.

### 1.3 Migração — dropar modelos órfãos  🗄️
- ⬜ **Migração** `pivo_remove_ia`: dropar `UsoIa`, `Conversa`, `MensagemConversa`,
  `Fluxo`, `No`, `Conexao`, **`FaqBot` (atual)**; remover de `Bot` os campos de IA
  (`politicasAgente`, `promptSistemaIa`, `provedorIa`, `modeloIa`, `temperaturaIa`,
  `credencialIaId`, `toolsHabilitadas`). *(A FAQ simples nova nasce na Fase 3.)*
- ⚠️ **Backup antes.** Migração destrutiva — confirmar que não há dado a preservar (é dev).

**Pronto quando:** o backend sobe sem a camada de IA; o front não tem mais as telas de
bot-IA/builder/inbox; o schema não tem os modelos órfãos; nada quebra (lint + `node --check`
+ smokes do ERP passando).

---

## Fase 2 — Adaptar a estrutura existente do ERP ao novo modelo

**Objetivo:** ajustar o que **fica** (ver `erp-pivo.md` §6) para o modelo ERP-first.

- ⬜ **`Bot` reduzido:** manter só `clienteId, nome, status, canal, identificadorCanal
  (phoneNumberId), credencialCanalId, verifyTokenCanal` + `estado`/menu simples. Limpar
  `bots.routes.js` do que era de IA (tools/preset/publish-de-IA).
- ⬜ **Segmento generalizado:** estender `modulosSegmento.js` para também gatear **tipos
  de usuário** e a **matriz módulos×ações** por segmento (loja não vê serviço; clínica
  não vê varejo). Base do gating da tela de Usuários (Fase 3).
- ⬜ **Tipos de credencial:** no enum `TipoCredencial`, **remover** os de IA de plataforma
  e **adicionar** `MERCADO_PAGO_KEY, ASAAS_KEY, PAGARME_KEY, FOCUS_NFE_KEY,
  NUVEM_FISCAL_KEY`.  🗄️ **Migração** `pivo_credenciais_tipos`.
- ⬜ **Revisar permissões/escopo** para os novos módulos (Pagamentos, Fiscal) e tipos.
- ✅ Categoria-por-uso (já feito) · ✅ Concluir atendimento (já feito) · ✅ Agenda elevada
  (já feito) · ✅ Vendas endurecida (já feito).

**Pronto quando:** o ERP roda no novo modelo (bot reduzido, segmento gateando tipos/módulos),
sem regressão nos módulos que ficaram.

---

## Fase 3 — Criar novas telas e funções

**Objetivo:** as telas/funcionalidades novas do ERP-first. Ver `telas.md` para os diagramas.

- ⬜ **Usuários & Equipe (unificada):** absorve o especialista como **tipo de usuário**
  (campos jornada/serviços quando tipo=Especialista → cria `Usuario` + `Especialista` em
  transação); **gating por segmento** (tipos + módulos×ações). **Aqui sim apaga a
  `EspecialistasPage`** e migra a lógica útil de `especialistas.routes` pra o fluxo de
  usuário. *(Dependência: Fase 2 do segmento generalizado.)*
- ⬜ **Bot WhatsApp (casca nova, sem IA):** tela de **conexão (Embedded Signup)** +
  configuração do **agendamento por menu** + **atendimento básico (menu + FAQ simples nova)**
  + **campanhas** (reaproveita a fila de recompra). Webhook de entrada com roteador de
  menu fixo. A `BotsPage` antiga **reduz** a esta casca (não é tela nova do zero).
- ⬜ **Pagamentos:** tela de **configuração** (escolher provedor + credencial) + lista de
  **cobranças** (`Cobranca`) com status. *(Integração técnica = Fase 4.)*
- ⬜ **Fiscal:** tela de **configuração fiscal** (provedor + certificado + regime) + lista
  de **documentos** (`DocumentoFiscal`). *(Integração = Fase 4.)*
- ⬜ **Modelos novos** 🗄️ **Migração** `pivo_pagamento_fiscal`: `Cobranca`,
  `ConfiguracaoPagamento`, `DocumentoFiscal`, `ConfiguracaoFiscal`, **`Faq` simples**
  (pares pergunta/resposta do atendimento básico — modelo enxuto, melhora depois).
- ⬜ Ajustar nav (`ClientLayout`/`AdminLayout`) e rotas para as telas novas.

**Pronto quando:** dono cria qualquer usuário (incl. especialista) numa tela só, com
gating por segmento; existem as telas de Pagamentos/Fiscal/Bot (mesmo que a integração
externa venha na Fase 4).

---

## Fase 4 — Integrações

**Objetivo:** ligar os adaptadores externos (ver `erp-arquitetura-e-operacao.md` §4–§6).

- ⬜ **Pagamentos (3 adaptadores):** `MercadoPagoAdapter`, `AsaasAdapter`, `PagarmeAdapter`
  sob a interface `ProvedorPagamento`; **webhook** `POST /webhooks/pagamento/:provedor`;
  efeito de confirmação (baixa venda/agendamento + lançamento PAGO); conciliação (job).
- ⬜ **Fiscal (2 adaptadores):** `FocusNFeAdapter`, `NuvemFiscalAdapter` sob `ProvedorFiscal`;
  emissão **assíncrona** (fila) de NFC-e (loja) e NFS-e (clínica); estados + retry.
- ⬜ **WhatsApp:** **Embedded Signup** (depende de **Meta Tech Provider + App Review** —
  dependência externa); Cloud API (enviar/receber); webhook + roteador de menu; campanhas
  via **template HSM**.
- 🔵 **Maquininha/TEF:** **Depois** — Connect TEF / Stone CONNECT.

**Pronto quando:** o tenant conecta o pagamento (1 dos 3) e recebe Pix/link com confirmação
automática; emite nota (1 dos 2); conecta o próprio WhatsApp e o bot agenda/responde/dispara.

---

## Dependências externas (contas/aprovações) — providenciar em paralelo
- **Meta Tech Provider + App Review** (WhatsApp Embedded Signup) — pode demorar semanas;
  começar cedo. O ERP + pagamentos **não dependem** disso.
- **Contas nos PSPs** (Mercado Pago/Asaas/Pagar.me) e **API fiscal** (Focus/Nuvem Fiscal).
- **Certificado digital** do tenant (para nota fiscal) — o tenant providencia.

## Resumo de migrações (rodar no host, na ordem)
1. `pivo_remove_ia` (Fase 1) — dropa modelos da IA.
2. `pivo_credenciais_tipos` (Fase 2) — ajusta enum de credencial.
3. `pivo_pagamento_fiscal` (Fase 3) — cria Cobranca/DocumentoFiscal/Configuracoes.

## Pendências
- [ ] Aprovar este plano (ordem e escopo das fases) para iniciar a Fase 1.

## Decisões fechadas (2026-06-19)
- ✅ `FaqBot` atual **apagado**; vira **FAQ simples** no atendimento básico (melhora depois).
- ✅ `BotsPage` **reduz** para "conexão WhatsApp" (não é removida).
