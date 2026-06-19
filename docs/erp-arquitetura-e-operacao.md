# ERP — Arquitetura e Operação (documento técnico completo)

> **Especificação técnica e operacional do produto após o pivô** (ver decisões em
> [`erp-pivo.md`](erp-pivo.md)). Descreve **como o sistema opera** (funcional) e a
> **estruturação da infraestrutura** (técnico), de ponta a ponta, sem deixar lacunas.
> Criado em 2026-06-19.

---

## 0. Escopo e premissas

- Produto: **ERP de gestão multi-tenant** para **lojas (varejo/produto)** e **clínicas/
  serviços (saúde)**, com **pagamento integrado** e um **bot de WhatsApp automatizado**
  (agendamento + atendimento básico + campanhas, sem IA).
- Premissas fixas: multi-tenant por `clienteId`; português do Brasil; LGPD; cifra em
  repouso de dados sensíveis; emissão fiscal **terceirizada** (API); pagamento via **PSP**;
  WhatsApp via **Cloud API** com **Embedded Signup** (cliente conecta a própria conta).
- O que NÃO existe mais: agente de IA, builder de fluxo, inbox de atendimento humano
  (ver `erp-pivo.md` §5).

---

## 1. Visão geral

```
                 ┌─────────────────────────────────────────────┐
                 │                  FRONTEND                    │
                 │   Admin (plataforma)   ·   App (tenant)      │
                 └───────────────────────┬─────────────────────┘
                                         │ HTTPS / JWT
                 ┌───────────────────────▼─────────────────────┐
                 │                  BACKEND (API)               │
                 │  Auth · Permissões · Módulos do ERP          │
                 │  Pagamentos · Fiscal · Bot · Filas (jobs)    │
                 └───┬───────────┬───────────┬──────────┬───────┘
                     │           │           │          │
              ┌──────▼──┐  ┌─────▼────┐ ┌────▼─────┐ ┌──▼──────┐
              │Postgres │  │  Redis   │ │  MinIO   │ │ Externos│
              │(Prisma) │  │(BullMQ)  │ │(arquivos)│ │ PSP·Fis·│
              └─────────┘  └──────────┘ └──────────┘ │ WhatsApp│
                                                     └─────────┘
```

Módulos do ERP: **Cadastros · Agenda · Vendas/PDV · Estoque · Caixa · Financeiro ·
Relatórios**, mais os transversais **Pagamentos · Fiscal · Bot WhatsApp**.

---

## 2. Perfis, papéis e permissões (operação de acesso)

### 2.1 Perfis
| Perfil | Quem é | Acesso |
|---|---|---|
| **ADMIN** | dono da plataforma (você) | global; cria tenants; **não** vê dado operacional do tenant nem conteúdo sensível |
| **CLIENT** | dono do tenant (loja/clínica) | tudo do próprio tenant |
| **ADMINISTRADOR** | gerente do tenant | tudo, menos o que o CLIENT restringir |
| **VENDEDOR / especialista** | operador / profissional | só os módulos e o **escopo** liberados |

### 2.2 Permissões
Modelo: **módulo × ação × escopo**.
- Ações: `visualizar`, `criar`, `editar`, `excluir` (e específicas: `responder`, `atribuir`).
- Escopo: **PRÓPRIAS** (só o que é do usuário, ex.: o especialista vê só a agenda dele) ou
  **TODAS**. ADMIN/CLIENT/ADMINISTRADOR são sempre TODAS.

### 2.3 Onboarding de um tenant
1. ADMIN cria o cliente com **nome, e-mail, segmento** (SERVICO/PRODUTO/HIBRIDO).
2. Sistema **auto-ativa os módulos** do segmento (`modulosSegmento.js`): BASE + AGENDA
   (serviço) / + ESTOQUE (produto) / + ambos (híbrido).
3. Cria o usuário **dono (CLIENT)** com senha inicial `123456` + `deveTrocarSenha`.
4. Tenant nasce **vazio** (sem categorias/dados pré-cadastrados — o dono cadastra).
5. Dono configura: categorias (por uso), especialistas (clínica), produtos/serviços,
   **conexão de pagamento (PSP)**, **dados fiscais**, **conexão do WhatsApp**.

---

### 2.5 Tela de Usuários & Equipe (criação unificada, gating por segmento)
**Toda criação de usuário acontece em uma só tela** (Usuários & Equipe), feita pelo
dono/administrador do tenant. Não há tela separada de especialistas.

- **Tipos de usuário** disponíveis dependem do **segmento do tenant**:
  - Loja (PRODUTO): Administrador, Vendedor/operador. *(sem "Especialista")*
  - Clínica/serviço (SERVICO): Administrador, **Especialista**, Recepção.
  - Híbrido: todos.
- **Matriz de permissões** (módulo × ação × escopo) também é **filtrada por segmento**:
  loja não vê módulos/ações só-de-serviço; clínica não vê os só-de-loja (estoque, PDV de
  balcão). Generaliza o `modulosSegmento.js`.
- **Especialista** = quando o tipo é Especialista, o formulário mostra **jornada + serviços
  que atende**; ao salvar, cria `Usuario` + `Especialista` (transação). Senha inicial
  `123456` + troca obrigatória; AGENDA-próprias garantida.

---

## 3. Módulos do ERP — operação

### 3.1 Cadastros
- **Clientes/Leads** (`Lead`): nome, telefone, e-mail, CPF, nascimento, etapa do funil,
  histórico. Base do CRM e do vínculo em vendas/agenda/campanhas.
- **Produtos/Serviços** (`Produto` + `VariacaoProduto`): tipo FISICO (estoque) ou SERVICO
  (duração). Preço, categoria financeira (**filtrada por uso**), imagem. Serviço **exige
  ≥1 especialista** vinculado.
- **Especialistas** (`Especialista`): nome, jornada (JSON), serviços (M:N). **Não tem tela
  própria** — é um **tipo de usuário** criado na tela de **Usuários** (§2.5). Ao criar um
  usuário do tipo Especialista, o sistema cria o `Usuario` (login, AGENDA-próprias) **+**
  o `Especialista` vinculado, em transação.

### 3.2 Agenda (clínica/serviço)
- Visões **Dia (coluna por profissional)**, **Semana**, **Mês**; filtros por especialista
  e status; faixa de resumo (agendados/concluídos/cancelados, **sem faturamento**).
- **Agendar:** cliente → serviço (busca) → traz valor/duração/especialista → data/hora →
  valida **conflito por especialista** + cliente-duplicado-no-dia → cria `Agendamento`.
- **Status:** PENDING → CONFIRMED → COMPLETED / CANCELED. Imutabilidade: item passado
  não-PENDING trava (preserva histórico/financeiro).
- **Concluir atendimento:** `PATCH /agenda/:id/concluir` → marca COMPLETED + **cria a
  venda do serviço** (`Venda.agendamentoId @unique`, trava dupla-conclusão) + lançamento
  + caixa. "Não compareceu" = CANCELED, sem venda.

### 3.3 Vendas / PDV (loja)
- **Registrar:** itens (variação + quantidade) → valida estoque + **preço não-negativo**
  + tetos → exige **caixa aberto** (409 se fechado) → cria `Venda` + baixa de estoque +
  lançamento financeiro (1 por categoria) — tudo em transação, número sequencial por tenant.
- **Cancelar:** exige **motivo (≥5 chars)** → status CANCELLED + **estorna estoque**
  (DEVOLUCAO idempotente) + cancela lançamentos. **Venda não se exclui** (sem rota de delete).
- **Vincular lead** retroativo (propaga aos lançamentos).

### 3.4 Estoque
- Produtos físicos, variações, **movimentações** (VENDA, DEVOLUCAO, ENTRADA, AJUSTE),
  saldo, alertas de estoque crítico, reposição. Baixa automática na venda.

### 3.5 Caixa
- **Sessão de caixa** (`SessaoCaixa`): abertura (fundo) → movimentações → fechamento
  (conferência saldo esperado × real). Venda manual exige caixa aberto; venda do bot/
  conclusão **abre AUTO_BOT** se não houver. Sangria/suprimento. Cron fecha o AUTO diário.

### 3.6 Financeiro
- **Lançamentos** (`LancamentoFinanceiro`): RECEITA/DESPESA, PAGO/PENDENTE/CANCELADO,
  vínculo a venda/caixa/categoria/lead.
- **Contas a pagar** (recorrentes/pontuais).
- **Categorias por uso** (`CategoriaFinanceira.uso`): SERVICO/PRODUTO/CAIXA/DESPESA —
  cada categoria só aparece nas telas do seu uso (criadas contextualmente em cada módulo;
  gestão geral em Financeiro → Categorias).

### 3.7 Relatórios
- Visão executiva, financeiro, vendas, caixa, estoque (CMV/ABC), fechamento mensal,
  exportação CSV/Excel/PDF. **Leitura** — vê todas as categorias.

---

## 4. Pagamentos (operação + integração)

### 4.1 Objetivo
Receber **online** (Pix, link, recorrência) e, depois, **presencial** (maquininha/TEF).
O recebimento é diferencial **e** receita (acquiring).

### 4.2 Arquitetura — camada plugável (3 PSPs desde o início)
Integramos os **3 meios de pagamento mais usados** do Brasil, **cada um atrás de uma
interface comum** (padrão adaptador). O resto do sistema **não sabe** qual PSP está em
uso — troca de provedor não mexe em venda/agenda/financeiro.

- **Provedores integrados (o tenant escolhe o seu):** **Mercado Pago**, **Asaas**, **Pagar.me**.
- **Interface `ProvedorPagamento`** (idêntica para os três): `criarCobrancaPix`,
  `criarLink`, `criarRecorrencia`, `consultarStatus`, `estornar`,
  `processarWebhook(payload, assinatura)`. Cada PSP tem um **adaptador** que a implementa
  (`MercadoPagoAdapter`, `AsaasAdapter`, `PagarmeAdapter`).
- **`ConfiguracaoPagamento`** por tenant: `provedor (MERCADO_PAGO|ASAAS|PAGARME),
  credencialId`. A credencial fica **cifrada no cofre** (`Credencial` tipo
  `MERCADO_PAGO_KEY|ASAAS_KEY|PAGARME_KEY`).
- Entidade **`Cobranca`** (agnóstica de provedor): `id, clienteId, origem (VENDA|
  AGENDAMENTO|AVULSA), refId, valor, metodo (PIX|LINK|CARTAO|RECORRENCIA), status
  (PENDENTE|PAGO|EXPIRADO|CANCELADO|ESTORNADO), provedor, provedorCobrancaId, qrCode/
  linkUrl, vencimento, pagoEm, criadoEm`.
- **Webhook por provedor** (`POST /webhooks/pagamento/:provedor`): o adaptador certo
  valida a assinatura → atualiza `Cobranca.status` → dispara o efeito (confirma venda/
  agendamento, gera lançamento PAGO). Idempotente por `provedorCobrancaId`.

> **Por que 3 e não 1:** o tenant já costuma ter conta em **uma** delas; deixá-lo usar a
> que tem reduz atrito de adoção. O custo extra é só **um adaptador por PSP** — o núcleo
> (`Cobranca`, webhooks, efeitos) é único.

### 4.3 Fluxos
1. **Pix avulso / sinal:** cria `Cobranca` PIX → retorna QR/copia-e-cola → cliente paga →
   webhook PAGO → confirma (ex.: sinal vira `Agendamento` CONFIRMED).
2. **Link de pagamento:** cria `Cobranca` LINK → envia URL (WhatsApp/e-mail) → pago → webhook.
3. **Recorrência/assinatura:** plano + ciclo → PSP cobra automático → webhook por ciclo →
   lançamento. (Útil para mensalidade de clínica/loja, ou planos do próprio SaaS.)
4. **Conciliação:** job diário cruza `Cobranca` PAGO × extrato do PSP (datas de liquidação).

### 4.4 Estados e bordas
- Idempotência do webhook (chave `pspCobrancaId`); cobrança **expira** (cron marca EXPIRADO);
  reembolso/estorno → `Cobranca` ESTORNADO + estorna a venda (fluxo de cancelamento).
- **Maquininha/TEF (Depois):** middleware (Connect TEF / Stone CONNECT) → venda no ERP
  popula o POS → retorno concilia automático.

---

## 5. Fiscal (operação + integração)

### 5.1 Arquitetura — camada plugável (2 emissores desde o início)
Emissão **via API de terceiro** — **não construímos fiscal**. Integramos os **2 emissores
mais usados** atrás de uma interface comum (padrão adaptador).

- **Provedores integrados (o tenant escolhe):** **Focus NFe**, **Nuvem Fiscal**.
- **Interface `ProvedorFiscal`** (idêntica para os dois): `emitirNFCe`, `emitirNFSe`,
  `cancelar`, `consultar`, `processarCallback`. Cada um tem seu **adaptador**
  (`FocusNFeAdapter`, `NuvemFiscalAdapter`).
- **`ConfiguracaoFiscal`** por tenant: `provedor (FOCUS_NFE|NUVEM_FISCAL), credencialId
  (cifrada), regime tributário, CNPJ, inscrição, certificado digital (referência segura),
  CSC (NFC-e), série, ambiente (homologação/produção)`.
- **`DocumentoFiscal`** (agnóstico): `id, clienteId, vendaId, tipo (NFCE|NFSE), status
  (PENDENTE|PROCESSANDO|EMITIDA|ERRO|CANCELADA), provedor, provedorDocId, numero, chave,
  urlPdf, urlXml, mensagemErro, criadoEm`.

### 5.2 Fluxos
1. **Loja (NFC-e):** ao fechar a venda → cria `DocumentoFiscal` NFCE → chama a API →
   PROCESSANDO → callback/poll → EMITIDA (guarda chave/PDF/XML) ou ERRO (retry/manual).
2. **Serviço/clínica (NFS-e):** ao concluir o atendimento → NFS-e (município ou **NFS-e
   Nacional**). Mesmo ciclo de estados.
3. **Cancelamento fiscal:** cancela o documento na API + marca CANCELADA (dentro do prazo legal).

### 5.3 Regras
- Emissão é **assíncrona** (fila) — nunca bloqueia a venda. Falha fiscal não desfaz a venda;
  fica como ERRO para reprocessar.

---

## 6. Bot WhatsApp (operação + integração) — sem IA

### 6.1 Conexão — Embedded Signup (o cliente conecta a própria conta)
- A **plataforma** é cadastrada como **Meta Tech Provider** (app Meta com **App Review**
  aprovado para WhatsApp) — **dependência externa**, ver §10.
- Tenant clica **"Conectar WhatsApp"** → popup do **Embedded Signup** → login na **conta
  do Facebook do próprio cliente** → autoriza → a plataforma recebe `access_token` +
  `phoneNumberId` + `wabaId`. Guarda cifrado (`Credencial` WHATSAPP_CLOUD_TOKEN) e em
  `Bot.identificadorCanal`. **Não é concierge.**
- Webhook da Meta validado por `verifyToken`; mensagens entram em `POST /webhooks/whatsapp`.

### 6.2 Operação (tudo por regra fixa — sem agente)
- **Roteador de menu:** a mensagem cai num **fluxo fixo** (estado por conversa em
  `estado` simples, sem IA). Ex.: "1) Agendar 2) Horário/endereço 3) Falar com a loja".
- **Agendamento (serviço):** menu → escolhe serviço → especialista → **horário livre**
  (reaproveita a lógica de `agenda.listarHorariosLivres`) → confirma → cria `Agendamento`
  + envia confirmação/lembrete (job).
- **Atendimento básico (loja):** respostas fixas (horário, endereço, formas de pagamento,
  catálogo, status de pedido/agendamento). Sem resolução → **fallback** ("entraremos em
  contato" / horário de atendimento). **Sem atendente humano dentro do app** (inbox morreu).
- **Campanhas:** seleciona público (ex.: **fila de recompra** já existente) → escolhe
  **template HSM aprovado** → job dispara em lote (respeitando limites/custo por conversa).

### 6.3 Limites
- Mensagem ativa (fora da janela de 24h) **exige template HSM aprovado** pela Meta.
- Custo **por conversa** (Cloud API) — considerar no preço do plano.

---

## 7. Fluxos ponta a ponta (operação integrada)

**A) Clínica — agendar → atender → receber → emitir nota**
```
Cliente (WhatsApp) → bot menu → agenda serviço c/ especialista (horário livre)
  → [opcional] sinal: Cobranca PIX → webhook PAGO → Agendamento CONFIRMED
  → dia do atendimento → "Concluir" no app → Venda do serviço + lançamento + caixa
  → Cobranca do restante (se houver) → DocumentoFiscal NFS-e (assíncrono) → EMITIDA
```

**B) Loja — venda no balcão → pagamento → NFC-e**
```
Operador → PDV (itens) → caixa aberto → Venda + baixa estoque + lançamento
  → pagamento: Pix (Cobranca) ou [Depois] maquininha/TEF → confirma
  → DocumentoFiscal NFC-e (assíncrono) → EMITIDA (cupom)
```

**C) Recompra — campanha**
```
Job calcula fila de recompra (comprou há N dias, não voltou)
  → dono escolhe template HSM → disparo em lote → cliente responde → bot agenda/atende
```

---

## 8. Infraestrutura e arquitetura técnica

### 8.1 Stack
- **Backend:** Node.js + Express; **Prisma** (ORM) sobre **PostgreSQL 16**.
- **Filas/jobs:** **BullMQ** sobre **Redis**.
- **Arquivos:** **MinIO** (S3-compatível) — imagens de produto, PDFs/XMLs fiscais.
- **Tempo real:** Socket.io (alertas, atualização de telas).
- **Frontend:** React 19 + Vite + Tailwind; Zustand (estado).
- **Orquestração:** Docker Compose (Postgres, Redis, MinIO, app).

### 8.2 Multi-tenant
- Isolamento **lógico** por `clienteId` em **toda** query (sem IDOR). ADMIN cruza tenants;
  membros são presos ao próprio `clienteId` no middleware.
- Cifra: dados sensíveis (mensagens, credenciais de PSP/fiscal/WhatsApp) **cifrados em
  repouso** (AES-256-GCM), chave derivada por tenant (HKDF). Credenciais de plataforma
  usam chave estável.

### 8.3 Segurança (defesa em profundidade)
- **AuthN:** JWT; **AuthZ:** módulo liberado + permissão × ação × escopo.
- **Validação de entrada:** bounds (preço não-negativo, tetos de quantidade/itens/texto),
  tipos, listas — em todas as rotas de escrita.
- **LGPD:** base legal, retenção, direito do titular; dado de saúde tratado como sensível;
  log de acesso a dado sensível (auditoria).
- **Segredos:** nunca em texto puro no banco/log/resposta; cofre cifrado.
- **Webhooks:** validação de assinatura (PSP, Meta) + idempotência.

### 8.4 Filas e jobs (BullMQ)
| Job | Função | Gatilho |
|---|---|---|
| Disparo de campanha | envia templates HSM em lote | manual/agendado |
| Lembrete de agendamento | confirma/lembra por WhatsApp | cron (horas antes) |
| Emissão fiscal | chama API e atualiza `DocumentoFiscal` | ao fechar venda/concluir |
| Conciliação de pagamento | cruza Cobranca × extrato PSP | cron diário |
| Fechamento de caixa AUTO | fecha sessão AUTO_BOT do dia | cron 00:0x |
| Expiração de cobrança | marca Cobranca EXPIRADO | cron |
| Relatório mensal | gera snapshot | cron mensal |

### 8.5 Integrações externas (arquitetura)
| Integração | Padrão | Direção |
|---|---|---|
| **PSP** (Asaas/Mercado Pago/Pagar.me) | REST + **webhook** | criar cobrança ↔ receber confirmação |
| **Fiscal** (Focus/eNotas/Nuvem Fiscal) | REST + callback/poll | emitir ↔ status do documento |
| **WhatsApp** (Meta Cloud API) | REST + **webhook** + Embedded Signup | enviar/receber mensagens; conectar número |
| **Maquininha/TEF** (Depois) | middleware TEF / POS | venda → POS ↔ retorno |

### 8.6 Armazenamento
- **Postgres:** dados transacionais (Prisma migrations no host).
- **Redis:** filas + cache leve.
- **MinIO:** binários (imagens, PDF/XML fiscal) com chave por tenant no caminho.

### 8.7 Ambientes e deploy
- **Local/dev:** Docker Compose; migrações `cd backend; npx prisma migrate dev` no host.
- **Produção:** (a definir) — container do app + Postgres/Redis/MinIO gerenciados ou em
  container; HTTPS; variáveis de ambiente (JWT_SECRET, DATABASE_URL, chaves de PSP/fiscal/Meta).
- **Migrações:** sempre versionadas (Prisma); nunca destrutivas sem backup.

### 8.8 Observabilidade e erros
- Log estruturado por rota; erros nunca vazam segredo ao cliente (500 genérico + log server).
- Alertas (Socket.io + `Alerta`) para falhas (fiscal ERRO, bot offline, estoque crítico).

---

## 9. Modelo de dados (visão geral)

**Mantidos (base do ERP):** `Cliente`, `Usuario`, `Lead`, `EtapaLead`, `Produto`,
`VariacaoProduto`, `Especialista`, `EspecialistaServico`, `Agendamento`, `Venda`,
`MovimentacaoEstoque`, `SessaoCaixa`, `LancamentoFinanceiro`, `CategoriaFinanceira` (com
`uso`), `ContaPagar`, `Notificacao`, `Alerta`, `Credencial`, `RelatorioMensal`.

**Removidos (camada IA/bot complexo):** `UsoIa`, `Bot.politicasAgente/promptSistemaIa/
provedorIa/modeloIa/temperaturaIa/credencialIaId/toolsHabilitadas`, **`FaqBot` (atual,
apagado)**, `Fluxo`/`No`/`Conexao`, `Conversa`/`MensagemConversa`.

**Novos (pagamento + fiscal):** `Cobranca`, `ConfiguracaoPagamento`, `DocumentoFiscal`,
`ConfiguracaoFiscal` — todos **agnósticos de provedor** (têm um campo `provedor`). Tipos
de credencial novos no cofre: `MERCADO_PAGO_KEY`, `ASAAS_KEY`, `PAGARME_KEY` (pagamento);
`FOCUS_NFE_KEY`, `NUVEM_FISCAL_KEY` (fiscal). A lógica específica de cada provedor vive
só nos **adaptadores** (`*/adapters/pagamento/*`, `*/adapters/fiscal/*`); o núcleo é único.

**Bot (reduzido):** `Bot` fica só com `clienteId, nome, status, canal, identificadorCanal
(phoneNumberId), credencialCanalId (token), verifyTokenCanal` + um `estado`/menu simples.
A `BotsPage` reduz a essa casca de **conexão WhatsApp** (não some).

**FAQ simples (novo):** `Faq` (pares pergunta/resposta por tenant) para o atendimento
básico — modelo enxuto agora; evolui quando houver clientes.

---

## 10. Dependências externas e contas necessárias

| Dependência | Para quê | Bloqueio |
|---|---|---|
| **Meta — Tech Provider + App Review** | Embedded Signup do WhatsApp | aprovação da Meta (semanas) |
| **PSP — 3 integrados** (Mercado Pago, Asaas, Pagar.me) | Pix, link, recorrência, webhook | o tenant tem conta + chave em 1 deles |
| **API fiscal — 2 integradas** (Focus NFe, Nuvem Fiscal) | NFC-e/NFS-e | conta + certificado digital do tenant |
| **Adquirência/TEF** (Stone/Connect TEF) | maquininha (Depois) | homologação |
| **Certificado digital** (por tenant) | assinar nota fiscal | o tenant providencia |

---

## 11. Riscos técnicos e mitigações

| Risco | Mitigação |
|---|---|
| App Review da Meta demora | começar pagamentos+ERP; WhatsApp entra quando aprovar |
| Fiscal por município (NFS-e) fragmentado | usar provedor que abstrai + NFS-e Nacional |
| Webhook perdido (pagamento/fiscal) | idempotência + reconciliação por job |
| Custo do WhatsApp (HSM/conversa) | embutir no preço; campanhas com limite |
| Migração de remoção (dropar modelos IA) | migração versionada + backup antes |
| Maquininha/TEF complexo | adiar; PSP/Pix cobre o MVP |

---

## Pendências deste documento
- [ ] Você validar a operação de cada módulo (§3–§6) e os fluxos ponta a ponta (§7).
- [ ] **Provedores definidos:** pagamento = Mercado Pago + Asaas + Pagar.me; fiscal =
      Focus NFe + Nuvem Fiscal. Confirmar ou trocar algum (a arquitetura plugável aceita
      swap sem mexer no núcleo).
- [ ] Confirmar os modelos novos (`Cobranca`, `ConfiguracaoPagamento`, `DocumentoFiscal`,
      `ConfiguracaoFiscal`, §9).
- [ ] Reconfirmar as fontes ◐ de pagamento da pesquisa (após reset do limite de sessão).
