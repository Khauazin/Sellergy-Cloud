> ⚠️ **DOCUMENTO HISTÓRICO — produto anterior (chatbot-first).** A direção mudou para
> **ERP-first** em 2026-06-19. O mapa de telas atual está em **[telas.md](telas.md)**;
> a fonte de verdade é [erp-pivo.md](erp-pivo.md) +
> [erp-arquitetura-e-operacao.md](erp-arquitetura-e-operacao.md). Onde divergir, valem os do pivô.

# Sellergy Cloud — Mapa de Telas e Fluxos

> **Documento #2 da suíte.** Deriva do [cérebro do negócio](cerebro-do-negocio.md).
> Define **cada tela**: o que mostra, quem acessa, o que integra e quais funções
> (do ERP e do Bot) ela precisa pra sustentar o sistema robusto.
>
> **Como vamos usar:** primeiro fechamos o **inventário** (esta versão). Depois
> passamos tela a tela preenchendo o **template** abaixo. No fim, relendo tudo,
> extraímos a lista de funções necessárias (ERP + Bot).
>
> Ancorado nas rotas reais (`frontend/src/App.jsx`) em 2026-05-29.

---

## Princípios (valem pra todas as telas)

1. **Modularidade na raiz:** toda tela respeita as 4 camadas — Plano · Módulos
   liberados · Segmento · Permissões (módulo × ação × **escopo**).
2. **Segmento molda a tela:** Serviço vê Especialistas/Agenda; Produto vê
   Estoque/Pedido; Híbrido vê os dois. O que não se aplica, não aparece.
3. **Builder = referência n8n, mas fácil:** o construtor de bot tem nós ricos
   (como o n8n), porém **sem processo excessivo** — montar um bot que atende,
   agenda e vende deve ser rápido. Nada de configuração que assuste o dono.
4. **Tudo que é manual entra no processo:** cada ação que hoje é feita "no olho"
   (responder, agendar, cobrar) tem botão/fluxo na tela e, quando faz sentido,
   uma tool equivalente pro bot.

---

## Template — o que definimos em cada tela

Para cada tela, preenchemos:

| Campo | O que responde |
|---|---|
| **Rota / arquivo** | onde vive |
| **Propósito** | pra que serve (1 linha) |
| **Quem acessa** | perfil (ADMIN/CLIENT/ADMINISTRADOR/VENDEDOR) · módulo+ação · escopo (próprias/todas) · segmento |
| **Dados / campos** | o que mostra e o que é editável |
| **Ações** | operações da tela, mapeadas às ações de permissão |
| **Integrações** | conexões com outros módulos (ex.: venda → estoque + caixa) |
| **Tools do bot** | quais tools do agente tocam os dados desta tela |
| **Estado** | ✅ existe · 🟡 placeholder · 🆕 novo — e o gap a construir |

---

## Inventário de telas (ancorado nas rotas reais)

Legenda de estado: ✅ existe · 🟡 placeholder · 🆕 novo

### A. Telas públicas
| Rota | Tela | Propósito | Estado |
|---|---|---|---|
| `/` | LandingPage | vitrine/marketing | ✅ |
| `/admin/login` | LoginPage | login do dono do sistema | ✅ |
| `/app/login` | ClientLoginPage | login do tenant | ✅ |
| `/trocar-senha` | TrocaSenhaPage | troca obrigatória de senha | ✅ |

### B. Ecossistema ADMIN — *seu acesso (dono do sistema)*
*Onde você cria clientes, bots e monta os fluxos.*

| Rota | Tela | Propósito | Estado |
|---|---|---|---|
| `/admin/dashboard` | DashboardPage | visão geral do sistema (todos os tenants) | ✅ |
| `/admin/clientes` · `/:id` | ClientsPage | criar/gerir tenants (mensalidade, plano, **segmento**, branding) | ✅ (segmento 🆕 estruturar) |
| `/admin/clientes/permissoes` | AdminPermissoesClientePage | liberar **módulos** por tenant | ✅ |
| `/admin/usuarios` | UsersPage | usuários do sistema (admins) | ✅ |
| `/admin/bots` | BotsPage | criar/gerir bots dos clientes (IA, provedor, prompt) | ✅ |
| `/admin/bots/:botId/tools` | BotToolsPage | habilitar tools do agente no bot | ✅ |
| `/admin/bots/:botId/canal` | BotCanalPage | vincular ao WhatsApp | ✅ (WhatsApp-only) |
| `/admin/builder/:botId` | BuilderPage | **construtor de fluxo (n8n-style)** | ✅ (estender p/ novas funções) |
| `/admin/alertas` | AlertsPage | alertas do sistema (bot offline, falhas) | ✅ |
| `/admin/relatorios` | ReportsPage | relatórios do sistema | ✅ |
| `/admin/configuracoes` · `/perfil` | ConfiguracoesAdminPage · PerfilPage | config do sistema + perfil | ✅ |

### C. Ecossistema TENANT — *o ERP do cliente*
*Perfis CLIENT / ADMINISTRADOR / VENDEDOR, sujeitos a módulos + permissões + escopo.*

| Rota | Tela | Propósito | Estado |
|---|---|---|---|
| `/app/dashboard` | ClientDashboardPage | KPIs do negócio do tenant | ✅ |
| `/app/crm` | CRMPage | funil/Kanban de leads | ✅ |
| `/app/agenda` | AgendaPage | agendamentos + **Especialistas/jornada** | ✅ (Especialistas 🆕) |
| `/app/vendas` | VendasPage | registrar vendas (baixa estoque + caixa) | ✅ |
| `/app/catalogo` | CatalogoPage | produtos **e** serviços (genérico) | ✅ |
| `/app/estoque/:aba` | EstoquePage | inventário, movimentações, reposição | ✅ |
| `/app/financeiro/:aba` | FinanceiroPage | lançamentos, contas a pagar, caixa, DRE | ✅ |
| `/app/mensagens` | (placeholder) | **Inbox** — handoff humano, escopo próprias/todas | 🟡 → 🆕 construir |
| `/app/relatorios/:aba` | RelatoriosPage | dashboards + fechamento mensal | ✅ |
| `/app/campanhas` | (placeholder) | disparos/recompra (restrições Meta) | 🟡 (fase 2) |
| `/app/bots` | (placeholder) | tenant vê/ajusta o próprio bot? (a decidir) | 🟡 (a decidir) |
| `/app/usuarios` | CrmUsersPage | equipe do tenant + permissões (+ vínculo Especialista) | ✅ (vínculo 🆕) |
| `/app/configuracoes` · `/perfil` | ConfiguracoesPage · PerfilPage | config do tenant e perfil. As integrações (credenciais) saíram daqui: quem cadastra é o admin, em Clientes › Integrações | ✅ |

### D. Conceitos novos que precisam de lugar na UI
Do [cérebro](cerebro-do-negocio.md), itens decididos que ainda não têm tela:

| Conceito | Onde mora (proposta) | Estado |
|---|---|---|
| **Especialistas** (recurso agendável + jornada + serviços que executa) | dentro de Agenda (aba/sub-tela) | 🆕 |
| **Base de Conhecimento / FAQ** do bot (atendimento) | dentro de Bots ou Builder (config do bot) | 🆕 |
| **Inbox de Mensagens** (handoff + escopo) | `/app/mensagens` (hoje placeholder) | 🆕 |
| **Segmento estruturado** (Serviço/Produto/Híbrido) | na criação/edição do cliente (admin) | 🆕 |

---

## Como vamos detalhar (a partir daqui)

Sugiro percorrer por **área**, preenchendo o template tela a tela, nesta ordem:

1. **ADMIN + Builder** — seu workspace e o construtor n8n-style (sua prioridade).
2. **Tenant — núcleo de venda/operação** — CRM, Agenda (+Especialistas), Vendas, Catálogo, Estoque.
3. **Tenant — Mensagens/Inbox** — a peça nova de handoff.
4. **Tenant — Financeiro + Relatórios + Dashboard.**
5. **Config, Perfil, Credenciais, Campanhas (fase 2).**

Cada área vira uma seção deste documento com o template preenchido.

---

## Núcleo Operacional do Bot — as três telas são um sistema só

> **Regra de negócio central.** `Bots`, `Mensagens` e `Campanhas` **não** são
> módulos separados — são as três faces de um mesmo **operador autônomo**. O que
> você configura (Bots) rege o que o bot faz ao vivo (Mensagens) e o que ele faz
> proativamente (Campanhas). Cada passo reflete no ERP em tempo real.

```
   ┌──────────── BOTS — você CONFIGURA o operador ────────────┐
   │ segmento · prompt · FAQ/conhecimento · tools · guardrails  │
   │ alçada · cadência de recompra · funil que ele move · canal │
   └───────────────────────────┬───────────────────────────────┘
                               │ define O QUE o bot faz
                               ▼
  cliente chega → MENSAGENS — o bot AGE ao vivo (atende · conduz · fecha)
                               │
          ┌────────────────────┼─────────────────────┐
       atende (FAQ)     conduz/fecha (tools)     escala (handoff)
          │              opera o ERP de verdade        │
          ▼              (CRM·Agenda·Vendas·Estoque·Caixa)
       responde                 │                  humano assume
                                ▼ depois de fechar  (escopo próprias/todas)
                   CAMPANHAS — o bot vai BUSCAR de volta
                   recompra · reativação · pós-venda
                                │
                                └──► reabre conversa → volta pra MENSAGENS
```

**A regra:** *uma conversa, um ciclo.* O que o bot faz numa conversa (Mensagens) é
regido pelo que foi configurado (Bots) e alimenta a recompra (Campanhas). As três
telas são **entrada, ação e retorno** do mesmo motor.

---

### Tela BOTS — configurar o operador (o "o que ele faz")
| Campo | Definição |
|---|---|
| **Rota / arquivo** | `/admin/bots` + `BotToolsPage` + `BotCanalPage` + `/admin/builder/:botId`. *(decisão pendente: o tenant ajusta o próprio bot em `/app/bots`?)* |
| **Propósito** | montar o comportamento inteiro do operador — não é "ligar a IA" |
| **Quem acessa** | ADMIN cria a estrutura; dono do tenant (CLIENT/ADMINISTRADOR) ajusta o conteúdo (FAQ, horários, cadência, tom) — *a confirmar* |
| **Dados / campos** | identidade + **segmento** (carrega o preset) · cérebro IA (provedor/modelo/prompt) · **FAQ/Conhecimento** 🆕 · tools habilitadas · **guardrails/alçada** 🆕 · funil que ele move · **cadência de recompra** 🆕 · handoff · canal |
| **Ações** | criar bot · editar comportamento · habilitar tools · publicar · testar |
| **Integrações** | CRM (etapas do funil) · Agenda (serviços/especialistas) · Catálogo · Credenciais (IA/WhatsApp) |
| **Tools do bot** | define **quais** ligar: `crm.*`, `agenda.*`, `catalogo.*`, `vendas.lancarVenda`, `conhecimento.buscar`, `mensagens.enviar` (dupla permissão: módulo + habilitada) |
| **Estado** | ✅ parcial — falta **FAQ/Conhecimento** 🆕, **guardrails/alçada** 🆕, **cadência** 🆕 |

### Tela MENSAGENS — o bot ao vivo + handoff (o "vendo ele agir")
| Campo | Definição |
|---|---|
| **Rota / arquivo** | `/app/mensagens` (hoje placeholder) |
| **Propósito** | cockpit das conversas — onde o humano vê o bot agir e assume quando preciso |
| **Quem acessa** | módulo `MENSAGENS` + **escopo**: Vendedor/Especialista = `PRÓPRIAS`; secretária/admin = `TODAS` |
| **Dados / campos** | lista de conversas (filtro por escopo, status, "aguardando humano", etapa, responsável) · histórico descifrado (AES-GCM) com autor (BOT/CLIENTE/VENDEDOR) e mídias WhatsApp · `Conversa.estado` (o que o bot extraiu: serviço, data, alergia) · indicador bot×humano |
| **Ações** | **responder** (qualquer tipo de msg WhatsApp) · **assumir** (handoff: pausa o bot) · devolver ao bot · **atribuir/reatribuir** · ações rápidas do lead (agendar, lançar venda, mover etapa) sem sair da conversa |
| **Integrações** | CRM (painel do lead na lateral) · Agenda (agendamentos) · Vendas (pedidos) · Especialista (responsável) · **auditoria** (`auditoria_acoes_agente`: o que o bot fez nessa conversa) |
| **Tools do bot** | reflete o resultado de todas — aqui se vê `mensagens.enviar`, `agenda.criarAgendamento`, `vendas.lancarVenda` etc. acontecendo |
| **Estado** | 🟡 placeholder → 🆕 construir (peça nova: escopo + handoff) |

### Tela CAMPANHAS — o bot proativo / retenção (o "ele vai atrás")
| Campo | Definição |
|---|---|
| **Rota / arquivo** | `/app/campanhas` (hoje placeholder) |
| **Propósito** | outbound que gera LTV — o bot reabre a conversa no momento certo |
| **Quem acessa** | módulo `CAMPANHAS` (a criar) — dono/gestor do tenant |
| **Dados / campos** | tipos (recompra, reativação, pós-venda, aniversário, abandono) · estrutura: **segmento** (quem — filtro de leads) + **gatilho** (quando) + **mensagem** (template HSM) + **objetivo** + **medição** |
| **Ações** | criar campanha · automática (gatilho) × disparo manual · medir conversão |
| **Integrações** | CRM (segmentação/etapas) · Vendas (última compra) · Agenda (retorno) · **cadência configurada em Bots** · restrições Meta (janela 24h × template HSM × custo por mensagem) |
| **Tools do bot** | a campanha **reabre a conversa** → resposta cai em Mensagens → bot atende/conduz de novo (`mensagens.enviar` + o ciclo todo) |
| **Estado** | 🟡 placeholder (fase 2, mas é parte da trindade) |

### O ciclo — como as três se ligam
1. **Campanhas** dispara (recompra/reativação) → o bot manda a mensagem.
2. Cliente responde → cai em **Mensagens**.
3. O bot atende/conduz/fecha conforme configurado em **Bots** → opera o ERP (CRM/Agenda/Vendas/Estoque/Caixa).
4. Se precisa, **handoff** → humano assume em Mensagens (por escopo).
5. Fechou → a **cadência** (definida em Bots) agenda a próxima **Campanha**.
6. Tudo auditado (`auditoria_acoes_agente`), por escopo/permissão, moldado pelo segmento.

---

## Seções detalhadas (demais áreas)
*(a preencher na ordem: 2. núcleo de venda/operação · 3. Mensagens detalhada · 4. Financeiro/Relatórios · 5. Config/Credenciais/Campanhas)*
