> ⚠️ **DOCUMENTO HISTÓRICO (chatbot-first).** Substituído pelo plano do pivô:
> **[plano-de-acao-pivo.md](plano-de-acao-pivo.md)** (2026-06-19). Mantido como registro
> do que foi feito no produto anterior.

# Sellergy Cloud — Plano de Ação por Fases

> **Documento de execução.** Costura o [cérebro do negócio](cerebro-do-negocio.md)
> (o quê/por quê) e o [mapa de telas](telas-e-fluxos.md) (onde) numa **sequência
> executável**. Ordem definida: **estruturar o que existe → criar as três telas →
> finalizar o admin**. Consolidado em 2026-05-29.

---

## Decisões-âncora (guiam todo o plano)

- **Segmentos:** Serviço + Produto + Híbrido — **motor único + presets** por segmento.
- **O bot é um operador** (a trindade `Bots` · `Mensagens` · `Campanhas`):
  atender → conduzir → fechar → operar, com handoff humano e recompra.
- **Modularidade na raiz:** Plano · Módulos liberados · Segmento · Permissões
  (módulo × ação × **escopo** PRÓPRIAS/TODAS).
- **Canal:** WhatsApp-only, conectado via **Embedded Signup** (o cliente só faz
  login no Facebook; **não** mexe no developer.facebook). Concierge no MVP.
- **IA:** **credencial de plataforma** (você coloca pelo admin) + **medição de uso
  por tenant** (controle de custo → preço).
- **Base de tudo:** multi-tenant por `clienteId`, cifra em repouso (AES-GCM),
  auditoria de ações do agente, LGPD.

---

## Visão geral

| Fase | Foco | Por quê primeiro |
|---|---|---|
| **1 — Estruturar o existente** ✅ *concluída* | dados, permissões e agente prontos pra regra de negócio | as telas não têm em que se apoiar sem isso |
| **2 — As três telas** ⬅️ *aqui agora* | Bots (config), Mensagens (inbox/handoff), Campanhas | dão rosto à trindade, sobre as fundações |
| **3 — Finalizar o admin** | criar clientes/bots, Embedded Signup, credencial de IA | o onboarding que coloca tudo pra rodar |
| **Transversal** | LGPD · segurança · cifra · auditoria | acompanha todas as fases |

---

## Fase 1 — Estruturar o que já existe pra regra de negócio ✅ CONCLUÍDA (2026-06-01)

**Objetivo:** deixar os modelos, as permissões e o agente prontos pra sustentar a
trindade e os dois segmentos. Em teste, o bot deve conseguir **atender por FAQ,
agendar com especialista real e fechar venda de produto** — idempotente e auditado.

| # | Entrega | Backend | Frontend | Depende de |
|---|---|---|---|---|
| 1.1 | **Segmento estruturado** | `Cliente.segmento` String → enum (Serviço/Produto/Híbrido) + migração; gating por segmento | — (consumido no admin, Fase 3) | — |
| 1.2 | **Permissões com escopo** | ações **por módulo** (não global) + dimensão `escopo` (PRÓPRIAS/TODAS); novo módulo `MENSAGENS`; ajustar `permissoes.middleware` | `constants/permissoes.js` (módulos/ações/escopo) | — |
| 1.3 | **Especialista** | model `Especialista` (nome, ativo, `usuarioId?`) + M:N com serviços + **jornada**; `Agendamento.especialistaId`; migração | — (UI na Fase 2/Agenda) | catálogo (serviços) |
| 1.4 | **Conversa com responsável** | `Conversa.especialistaId`/`usuarioId` pra roteamento + escopo | — | 1.2, 1.3 |
| 1.5 | **Comportamento do bot** | campos de **guardrails/alçada** (confirmar venda, teto, desconto), **cadência** de recompra, config de **handoff**; model **BaseConhecimento/FAQ** (pares pergunta/resposta) | — (UI na Fase 2/Bots) | — |
| 1.6 | **Tools novas + orquestrador** | `agenda.listarHorariosLivres` (especialista apto + jornada + conflito); `conhecimento.buscar` (FAQ); **orquestrador de intenção** (atender/vender/escalar) no executor | — | 1.3, 1.5 |
| 1.7 | **Resiliência do agente** | **idempotência** (chave por evento de webhook + por ação de escrita); **resumo/memória** persistido em `Conversa.estado` | — | — |
| 1.8 | **Credencial de IA de plataforma** | credencial não-tenant (admin) usada por padrão pelos bots; **medição de uso** por tenant | — (UI no admin, Fase 3) | — |
| 1.9 | **Catálogo genérico** | confirmar que CATALOGO serve produto + serviço | revisar rótulos/UX | — |

**Pronto quando:** num bot de teste, o agente atende uma dúvida (FAQ), oferece
horário real de um especialista e fecha um pedido — com permissões por escopo
ativas, sem duplicar (idempotência) e com trilha em `auditoria_acoes_agente`.

---

## Fase 2 — As três telas (núcleo operacional)

**Objetivo:** dar rosto à trindade, sobre as fundações da Fase 1.

| # | Tela | Entregas principais | Depende de |
|---|---|---|---|
| 2.1 | **Bots (config completo)** | identidade+segmento (preset) · cérebro IA · **FAQ/Conhecimento** · tools · **guardrails/alçada** · **cadência** · handoff · builder. *(decisão: tenant ajusta conteúdo × admin-only)* | 1.1, 1.5, 1.6, 1.8 |
| 2.2 | **Mensagens / Inbox** | lista por **escopo** · conversa descifrada · `Conversa.estado` · indicador bot×humano · **handoff** (assumir/devolver/atribuir) · painel do lead lateral · trilha de auditoria · responder (tipos WhatsApp) | 1.2, 1.4 |
| 2.3 | **Campanhas** | tipos · segmento+gatilho+mensagem+objetivo+medição · restrições Meta (template HSM). *No v1, recompra leve (cérebro 7.1); campanhas completas = fase 2 do produto* | 1.1, CRM |

**Pronto quando:** o dono configura o bot, vê as conversas ao vivo, assume um
handoff e dispara uma recompra.

---

## Fase 3 — Finalizar o admin (seu painel + onboarding)

**Objetivo:** você cria clientes e bots com baixíssimo atrito.

| # | Entrega | Detalhe |
|---|---|---|
| 3.1 | **Criar cliente com segmento + módulos** | ao criar tenant, escolher o segmento → auto-ativa módulos certos + preset do bot |
| 3.2 | **Credencial de IA de plataforma (UI)** | admin seta a chave da IA usada pelos bots; painel de **uso por tenant** |
| 3.3 | **Embedded Signup do WhatsApp** | botão "Conectar WhatsApp" (popup Meta) + endpoint de troca de token + webhook automático. **MVP: concierge** (você conecta pelo cliente) |
| 3.4 | **Gestão de bots** | criar / publicar / duplicar bot por cliente |

**Pronto quando:** você cria um cliente, escolhe o segmento, conecta o WhatsApp
dele e publica o bot — em minutos.

---

## Transversal (acompanha todas as fases)

- **LGPD** (doc #4): base legal, consentimento, retenção, direitos do titular.
- **Segurança:** cifra em repouso, escopo multi-tenant, auditoria de acesso a mensagens.
- **Já feito:** remoção dos canais não-WhatsApp (foco no WhatsApp).

---

## Estado (2026-06-02)

**Fase 1 concluída** (1.1–1.9; migrações aplicadas).
**Fase 2 — telas:** ✅ Bots config · ✅ Inbox de Mensagens (escopo + handoff) ·
✅ Especialistas (com criação de login) · ✅ Campanhas (2.3, v1 = recompra leve).
**Fase 3 — admin:** ✅ 3.1 criar cliente com segmento + auto-ativa módulos ·
✅ 3.2 credencial de IA de plataforma (admin) + uso por tenant · ✅ 3.4 gestão de
bots (publicar/despublicar + duplicar completo). 3.3 Embedded Signup = concierge
(ver itens travados).

**Construído nesta rodada (2026-06-02):**
- **"Concluir atendimento"** ✅ — `PATCH /agenda/:id/concluir` fecha serviço→venda
  (venda + lançamento + caixa AUTO), `Venda.agendamentoId @unique` trava
  dupla-conclusão; botões "Concluir e gerar venda" / "Não compareceu" na Agenda.
- **3.1 Onboarding por segmento** ✅ — `modulosSegmento.js` auto-ativa módulos
  (BASE + AGENDA/ESTOQUE por segmento); preview no modal de criar cliente.
- **3.2 IA de plataforma** ✅ — `/admin/ia` (CRUD credencial cifrada, 1 por
  provedor) + painel de uso (`UsoIa`) por tenant; tela admin "Inteligência (IA)".
- **3.4 Bots** ✅ — `PATCH /bots/:id/status` (publicar/despublicar); duplicate
  agora copia tools + políticas + FAQs.
- **Campanhas v1 (recompra)** ✅ — `GET /campanhas/recompra` + tela com fila e
  ação manual via `wa.me`.

**Itens travados (dependência externa) → ver [integracoes-pendentes.md](integracoes-pendentes.md):**
sinal/checkout (PSP), reembolso (API de estorno PSP), Embedded Signup (App Review
Meta), disparo HSM em massa (templates Meta). Todos com fallback v1 operável e
ponto de encaixe interno já pronto.

**Frente própria (não bloqueia lançamento):** imutabilidade/autoria
(venda/caixa/financeiro/agenda não excluíveis por usuário comum); lembrete
pós-agendamento; avisos por e-mail.

**Operacional:** liberar **MENSAGENS** pro tenant (inbox), **AGENDA** (especialistas),
**CRM** (campanhas/recompra). Migração desta rodada (rodar no host):
`cd backend; npx prisma migrate dev --name venda_agendamento`.
