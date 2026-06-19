# ERP de Gestão — Documentação do Pivô (lojas + clínicas)

> **Documento mestre da virada `chatbot-first → ERP-first`.** Substitui a moldura
> dos documentos anteriores (`cerebro-do-negocio.md`, `telas-e-fluxos.md`,
> `plano-de-acao.md`), que passam a ser **histórico** do produto anterior (bot-vendedor
> de IA). Documento **vivo**: você decide nas tabelas (coluna **Decisão**).
> Criado em 2026-06-19.

---

## Como usar este documento

- Toda tabela de escopo tem uma coluna **Decisão** com 4 estados:
  - **Agora** — entra no MVP / primeira leva.
  - **Depois** — fica para uma fase seguinte.
  - **Não** — descartado.
  - **Decidir** — pendente da sua escolha.
- As seções **5 (morre)**, **6 (fica)** e **7 (remonta)** listam os **arquivos reais**
  do código atual, pra a migração ser cirúrgica — nada de apagar no escuro.
- Confiança das afirmações de mercado: ✅ verificado com fonte · ◐ fonte coletada,
  verificação interrompida (provável, a confirmar) · ▸ análise / leitura de mercado.

---

## 1. A decisão (a linha de pensamento)

**De onde viemos:** um SaaS multi-tenant cujo produto central era um **bot-vendedor
de IA no WhatsApp** (agente com function-calling agindo sobre o ERP) e um painel de
**criação de bots** no admin. Embaixo, um ERP real (CRM, agenda, catálogo, estoque,
vendas, caixa, financeiro).

**Por que virar:** a camada de IA/agente é **complexa e cara de manter e integrar**
nesta fase, e — confirmado pela pesquisa — **agendamento e lembrete por WhatsApp já
são commodity** (estão na base dos concorrentes, não no diferencial). Ou seja, o que
era "o diferencial" diferencia pouco e custa muito.

**Para onde vamos:**
- O **ERP de gestão** vira o **produto central**, para **lojas (varejo/produto)** e
  **clínicas (serviço/saúde)** — os dois segmentos, com motor único + presets.
- O **recebimento integrado** (Pix, link de pagamento, recorrência, maquininha) vira
  a alavanca de valor **e de receita** — é o que os líderes fazem.
- O **bot encolhe** para uma **feature simples**: agendamento por WhatsApp + disparo
  de campanhas. **Sem agente de IA, sem agir sobre o ERP, sem builder de fluxo.**

**Frase-resumo:** *deixamos de ser "chat de vendas e agendamento com ERP embaixo"
para ser um "ERP de gestão para loja e clínica, com pagamento embutido e um
WhatsApp leve por cima".*

---

## 2. Fundamentação de mercado (resumo da pesquisa)

Pesquisa profunda (26 fontes, 122 afirmações, 25 verificadas; síntese automática
interrompida por limite de sessão — sintetizada à mão). Itens ◐ ficaram sem o voto
final e serão reconfirmados.

### 2.1 Players e preços

| Player | Segmento | Preço (R$/mês) | Pagamento embutido | Conf. |
|---|---|---|---|---|
| **Bling** (Cobalto) | Varejo / e-commerce | **55** | integrações de gateway/marketplace | ✅ |
| **VHSYS** (Gestão Integrada) | Varejo + serviço | *(faixa não confirmada)* | **Conta PJ + maquininha Stone grátis + Pix/boleto/TED ilimitados** | ✅ feat. |
| **Hiper** | Varejo pequeno (30+ ramos) | ▸ ~100–200 | **Pix + TEF integrado + POS Stone direto** | ✅ feat. |
| **iClinic** | Clínica / saúde | **99 → 299 / profissional** | agendamento + lembretes na base | ✅ |
| **Feegow** | Clínica | **129 / 199 / 249 / profissional** | — | ✅ |
| Tiny, Omie, ContaAzul | Varejo / financeiro PME | ▸ grátis–200 | gateways | ▸ |
| Clinicorp, Simples Dental | Odonto | ▸ por cadeira/prof. | — | ▸ |
| Trinks, Booksy | Salão/estética (agenda) | ▸ por profissional | link/maquininha | ▸ |

**Leituras:**
- Varejo tem **ERP horizontal barato** (Bling R$ 55) que já embute fiscal + pagamento.
- Saúde cobra **por profissional** (R$ 99–299/prof.) — caro pra equipe, barato pra
  autônomo. **Brecha de preço** para times pequenos.

### 2.2 Pagamentos — o ponto central

Sinal verificado: os líderes **embutem pagamento e adquirência** como **tablestake
+ receita** (VHSYS dá maquininha Stone grátis; Hiper integra Pix + TEF + POS Stone).

**Viabilidade para um entrante:**
- **Fácil (começar aqui):** PSP com API → **Pix + link de pagamento + recorrência +
  confirmação por webhook**. Candidatos: **Asaas** ◐, **Mercado Pago**, **Pagar.me** ◐,
  Iugu (split), Stripe.
- **Difícil (depois):** **maquininha física (TEF/POS)** exige homologação por
  adquirente. Atalhos: **Connect TEF** (middleware: integra 1×, várias maquininhas) ◐
  ou **Stone CONNECT 2.0** ◐.

### 2.3 Fiscal e regulatório (custo de entrada)

- **Varejo:** NFC-e/SAT (PDV) + NF-e são tablestake (Hiper e VHSYS embutem ✅).
  **Não construir fiscal:** usar API de terceiro (**Focus NFe, eNotas, Nuvem Fiscal,
  PlugNotas, Tecnospeed**). NFS-e é fragmentada por município; **NFS-e Nacional**
  simplifica ◐.
- **Clínica:** prontuário com requisitos **CFM** + certificação **SBIS** (opcional) ◐;
  **LGPD** pesada (dado de saúde sensível); **TISS** (convênio) é o **maior fosso** e
  a maior complexidade — evitável escolhendo nicho **particular (sem convênio)**.

### 2.4 O bot é commodity, não fosso

Verificado: iClinic inclui **agendamento + lembrete em TODOS os planos** (base, não
premium ✅); a hipótese de "lembrete por WhatsApp = diferencial premium" foi
**refutada (0-3)**. WhatsApp Cloud API + templates HSM **têm custo por conversa** ◐.
→ **Bot leve, sim; bot como produto, não.**

### 2.5 Conclusão estratégica

O pivô **faz sentido**. O mercado de ERP é saturado — o ganho está em **3 alavancas
combinadas**: (1) **vertical estreito** preferencialmente **particular (foge do TISS)**;
(2) **recebimento embutido** como diferencial e receita; (3) **bot leve** por cima.

---

## 3. Posicionamento e segmentos

- **Dois segmentos**, motor único + presets (a base já existe: enum
  `SegmentoCliente {SERVICO, PRODUTO, HIBRIDO}` e `Cliente.segmento`).
- **Loja (PRODUTO):** PDV/venda, estoque, NFC-e.
- **Clínica/serviço (SERVICO):** agenda + especialistas, atendimento, NFS-e.
- **Híbrido (HIBRIDO):** os dois (ex.: clínica que vende produtos).

| Decisão de produto | Decisão |
|---|---|
| Manter os dois segmentos no MVP | **Agora** |
| Verticalizar para um nicho específico de cada lado (marketing/posição) | Decidir |
| Atender convênio/TISS (clínica) | Decidir *(recomendado: **Não** no MVP)* |

---

## 4. Arquitetura-alvo — módulos do ERP

Motor multi-tenant por `clienteId`, permissões (módulo × ação × escopo), cifra em
repouso, LGPD. Módulos:

| Módulo | Para | Estado hoje | Decisão |
|---|---|---|---|
| **Cadastros** (clientes/leads, produtos/serviços, especialistas) | ambos | existe | Agora |
| **Agenda** (dia/semana/mês, por profissional) | clínica/serviço | recém-elevada | Agora |
| **PDV / Vendas** | loja | existe | Agora |
| **Estoque** | loja | existe | Agora |
| **Caixa** | ambos | existe | Agora |
| **Financeiro** (lançamentos, contas a pagar, categorias por uso) | ambos | existe | Agora |
| **Relatórios** | ambos | existe | Agora |
| **Pagamentos integrados** (Pix, link, recorrência) | ambos | **a construir** | Agora |
| **Fiscal** (NF-e/NFC-e/NFS-e via API) | ambos | **a construir** | **Agora** ✔ |
| **Maquininha / TEF** | loja | **a construir** | Depois |
| **Bot WhatsApp** (agendar + campanha + atendimento básico) | ambos | **remontar** | **Agora** ✔ |

---

## 5. O que MORRE — a camada de IA/agente (candidatos a exclusão)

> Tudo aqui é a "inteligência" do bot-vendedor. Some na virada. Marque **Excluir**
> (apaga) ou **Decidir** se quiser preservar algo.

| Componente | Arquivos | Por que morre | Decisão |
|---|---|---|---|
| **Agente de IA** (loop function-calling OpenAI/Anthropic/Gemini) | `backend/src/engine/executores/aiAgent.js` | é o cérebro do bot-vendedor | Excluir |
| **Registry de tools do agente** | `backend/src/agente/tools/*` (`index.js`, `agenda.js`, `catalogo.js`, `crm.js`, `mensagens.js`, `vendas.js`, `conhecimento.js`, `conversa.js`) | tools que o agente usava pra **agir no ERP** | Excluir |
| **Orquestrador / executor do agente** | `backend/src/agente/executor.js` | — | Excluir |
| **Presets de segmento do agente** | `backend/src/agente/presets.js` | prompt/tools por segmento do bot | Excluir |
| **Credencial de IA de plataforma + medição** | `backend/src/routes/admin-ia.routes.js`, `frontend/src/pages/AdminIaPage.jsx`, modelo `UsoIa`, sentinela `CLIENTE_ID_PLATAFORMA` e `carregarCredencialPlataformaPorTipo` em `backend/src/credenciais.js` | só servia pra IA do agente | Excluir |
| **Config do bot (cérebro/IA/FAQ/políticas)** | `frontend/src/pages/BotConfigPage.jsx`, FAQ (`FaqBot`), `Bot.politicasAgente`, `Bot.promptSistemaIa`, `Bot.provedorIa`, `Bot.modeloIa`, `Bot.temperaturaIa`, `Bot.credencialIaId` | configuração do agente | Excluir |
| **Ferramentas do agente (UI)** | `frontend/src/pages/BotToolsPage.jsx`, `PATCH /bots/:id/tools`, `Bot.toolsHabilitadas` | habilitar tools do agente | Excluir |
| **Builder visual de fluxo** | `frontend/src/pages/BuilderPage.jsx`, `frontend/src/components/Builder/*`, `backend/src/routes/builder.routes.js`, modelos `Fluxo`/`No`/`Conexao`, nó `AI_AGENT` | bot deixa de ter fluxo arbitrário | **Excluir** ✔ |
| **Sandbox isolated-vm** | uso do `isolated-vm` no engine | sem agente, sem código sandboxed | Excluir |
| **Inbox/Mensagens + handoff** | `frontend/src/pages/MensagensPage.jsx`, `backend/src/routes/conversas.routes.js`, modelos `Conversa`/`MensagemConversa`, relação `Conversa.lead` | bot não tem atendimento humano in-app; atendimento é automatizado | **Excluir** ✔ |
| **Gestão de bots (CRUD/publicar/duplicar)** | `frontend/src/pages/BotsPage.jsx`, `backend/src/routes/bots.routes.js`, modelo `Bot` | **reduzir** para "conexão WhatsApp" simples (ver §7) — não excluir | **Reduzir** ✔ |
| **FAQ do agente (`FaqBot`)** | modelo `FaqBot` + CRUD `/bots/:id/faq` | apaga o atual; renasce como **FAQ simples** no atendimento básico (ver §7.1) | **Excluir + recriar simples** ✔ |
| **Tela dedicada de Especialistas (UI)** | `frontend/src/pages/EspecialistasPage.jsx` | especialista é um **usuário**; criação migra pra a tela de **Usuários** (ver §6.1). O **modelo** `Especialista` permanece. | **Excluir** ✔ |

---

## 6. O que FICA — base do ERP (mantém e vira o produto)

| Base | Arquivos / modelos | Decisão |
|---|---|---|
| **Multi-tenant + auth** | `Cliente`, `Usuario`, `auth.middleware`, JWT | Manter |
| **Permissões (módulo × ação × escopo)** | `permissoes.middleware`, `CrmUsuariosController`, `Usuario.permissoes` | Manter |
| **Segmento** | enum `SegmentoCliente`, `Cliente.segmento`, `modulosSegmento.js` | Manter |
| **CRM / Leads** | `CRMPage`, `crm.routes`, `Lead`, etapas | Manter |
| **Agenda** | `AgendaPage` (elevada), `agenda.routes`, `Agendamento` | Manter |
| **Especialista (modelo + agenda)** | `Especialista`, `EspecialistaServico` (M:N com serviço) | Manter — **mas gerido pela tela de Usuários** (ver §6.1), não por tela própria |
| **Catálogo (produto+serviço)** | `CatalogoPage`, `CatalogoController`, `Produto`, `VariacaoProduto` | Manter |
| **Estoque** | `EstoquePage`, `EstoqueController`, `MovimentacaoEstoque` | Manter |
| **Vendas** | `VendasPage`, `VendaController` (recém-endurecido), `Venda` | Manter |
| **Caixa / Financeiro** | `FinanceiroPage`, `CaixaController`, `FinanceiroController`, `SessaoCaixa`, `LancamentoFinanceiro`, `CategoriaFinanceira` (+ `uso`) | Manter |
| **Concluir atendimento (serviço→venda)** | `PATCH /agenda/:id/concluir`, `Venda.agendamentoId` | Manter |
| **Relatórios** | `RelatoriosPage`, `RelatoriosController` | Manter |
| **Cifra em repouso / cofre** | `cripto/cofreCredenciais`, `cofreMensagens` | Manter *(cofre serve pra credenciais de pagamento/fiscal também)* |

---

### 6.1 Especialista vira **tipo de usuário** (criado na tela de Usuários)
A tela própria de especialistas **morre**. O especialista passa a ser criado **na mesma
tela onde os outros usuários são criados** (Usuários & Equipe), pelo dono/administrador
do tenant. Quando o tipo escolhido é **Especialista**, o formulário mostra os campos
extras dele (jornada, serviços que atende) e o sistema cria o `Usuario` **+** o registro
`Especialista` vinculado, numa transação.

**Gating por segmento (regra geral, vale pra toda a tela de Usuários):**
- **Loja (PRODUTO):** **não** mostra o tipo "Especialista"; mostra módulos/ações de
  varejo (estoque, PDV/vendas).
- **Clínica/serviço (SERVICO):** mostra o tipo "Especialista"; **esconde** módulos/ações
  só-de-loja (estoque, PDV de balcão); mostra agenda/serviço.
- **Híbrido (HIBRIDO):** mostra os dois conjuntos.

Ou seja, **o segmento do tenant filtra os tipos de usuário e a matriz de
módulos×ações** exibidos. Generaliza o que `modulosSegmento.js` já faz com módulos.

| Item | Decisão |
|---|---|
| Apagar `EspecialistasPage` | **Excluir** ✔ |
| Criar especialista na tela de Usuários (com campos jornada/serviços quando tipo=Especialista) | **Agora** ✔ |
| Gating de tipos de usuário e de módulos/ações por segmento | **Agora** ✔ |
| Manter modelo `Especialista`/`EspecialistaServico` (recurso da agenda) | **Manter** ✔ |

---

## 7. O que é REMONTADO (rebuilt)

### 7.1 Bot WhatsApp (substitui o agente de IA) — sem IA, automatizado
Três usos, todos **automatizados por regra** (menu/fluxo fixo), **sem agente, sem
function-calling, sem atendimento humano in-app** (a Inbox morreu):
- **Agendamento (clínica/serviço):** o cliente fala no WhatsApp → fluxo guiado por
  menu (escolhe serviço → especialista → horário livre) → cria `Agendamento` +
  confirma/lembra. Reaproveita `agenda.listarHorariosLivres` (a lógica, não a tool de IA).
- **Atendimento básico (loja):** menu fixo + **FAQ simples** (pares pergunta/resposta) —
  horário, endereço, formas de pagamento, status de pedido/agendamento, catálogo. Não
  resolveu → resposta de fallback (ex.: "te ligamos"). Sem humano respondendo dentro do app.
  *(O `FaqBot` antigo, acoplado ao bot-IA, é apagado; esta FAQ é um modelo simples novo —
  básica por enquanto, melhora quando houver clientes.)*
- **Campanhas:** dispara mensagem (recompra/promoção) para uma lista, via **template
  HSM aprovado**. A **fila de recompra já existe** (`campanhas.routes.js` + `CampanhasPage`).

**Conexão do número — Embedded Signup (o cliente conecta a própria conta):** o lojista/
clínica clica "Conectar WhatsApp", faz login na **própria conta do Facebook** (popup
Meta), autoriza, e a plataforma recebe o token + `phoneNumberId`. **Não é concierge.**
Exige que a plataforma seja **Meta Tech Provider com App Review aprovado** (dependência
externa — ver doc de operação/infra).

| Item | Decisão |
|---|---|
| Embedded Signup (cliente conecta o próprio WhatsApp) | **Agora** ✔ |
| Agendamento por menu (sem IA) | **Agora** ✔ |
| Atendimento básico por menu/FAQ (loja) | **Agora** ✔ |
| Campanhas via template HSM | **Agora** ✔ |
| Atendimento humano in-app (inbox) | **Não** ✔ |

### 7.2 Pagamentos integrados (novo módulo — camada plugável, 3 PSPs)
Integramos os **3 mais usados** atrás de uma interface comum (adaptador); o tenant
escolhe o dele. Detalhe técnico em `erp-arquitetura-e-operacao.md` §4.

| Capacidade | Provedores | Decisão |
|---|---|---|
| **Pix (cobrança/QR) + link de pagamento** | **Mercado Pago + Asaas + Pagar.me** | **Agora** ✔ |
| **Confirmação automática (webhook)** → baixa venda/agendamento | idem | **Agora** ✔ |
| **Recorrência / assinatura** | idem (Asaas forte nisso) | **Agora** ✔ |
| **Split de pagamento** (multi-tenant/parceiros) | idem | Depois |
| **Maquininha / TEF (POS físico)** | Connect TEF / Stone CONNECT | Depois |
| Credencial do PSP no cofre cifrado | — | **Agora** ✔ |

### 7.3 Fiscal (novo módulo — via API de terceiro, camada plugável, 2 emissores)
Integramos os **2 mais usados** atrás de uma interface comum; o tenant escolhe.
Detalhe técnico em `erp-arquitetura-e-operacao.md` §5.

| Item | Provedores | Decisão |
|---|---|---|
| Emissão via API | **Focus NFe + Nuvem Fiscal** | **Agora** ✔ |
| NFC-e/SAT (loja) | idem | **Agora** ✔ |
| NFS-e / NFS-e Nacional (serviço/clínica) | idem | **Agora** ✔ |

---

## 8. Roadmap modular do MVP (ordem sugerida)

1. **Limpeza do pivô** — remover a camada de IA/agente (§5), reduzir "bot" a conexão.
2. **ERP sólido** — fechar agenda/vendas/caixa/financeiro (a maior parte já está).
3. **Pagamentos** — Pix + link + webhook por 1 PSP. *(encaixa a estrutura de
   sinal/pagamento já moldada em `fluxo-atendimento-e-pagamento.md`)*
4. **Bot simples** — autoagendamento + campanha (sem IA).
5. **Fiscal** — via API, conforme nicho.
6. **Maquininha/TEF** — por último.

| Etapa | Decisão |
|---|---|
| 1. Limpeza (excluir IA/agente, Inbox, Builder) | **Agora** ✔ |
| 2. ERP sólido | **Agora** ✔ |
| 3. Pagamentos (Pix+link+webhook) | **Agora** ✔ |
| 4. Bot (Embedded Signup + agendamento + atendimento + campanhas) | **Agora** ✔ |
| 5. Fiscal (NFC-e/NFS-e via API) | **Agora** ✔ |
| 6. Maquininha/TEF | Depois |

---

## 9. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Mercado de ERP saturado | Nicho/posição estreita; recebimento embutido como diferencial |
| Complexidade fiscal | Terceirizar fiscal (API); evitar convênio/TISS no MVP |
| Maquininha/TEF difícil | Começar por PSP (Pix/link); maquininha via middleware depois |
| Pagamento virou tablestake | Transformar em vantagem (receita de acquiring) |
| CAC alto | Entrar por vertical + indicação dentro do nicho |
| Custo do WhatsApp (HSM) | Bot leve; começar por autoagendamento por link |

---

## 10. Referências (fontes da pesquisa)

✅ verificadas: [Bling – preços abr/2026](https://ajuda.bling.com.br/hc/pt-br/articles/30224184866583-Altera%C3%A7%C3%A3o-nos-planos-e-pre%C3%A7os-do-Bling-em-abril-de-2026) ·
[VHSYS – planos](https://www.vhsys.com.br/planos-e-precos/) ·
[Hiper](https://hiper.com.br/) ·
[iClinic – preços](https://iclinic.com.br/precos/) ·
[Feegow – preços](https://feegowclinic.com.br/precos-e-planos)

◐ coletadas (a reconfirmar): [Asaas API](https://www.asaas.com/api-de-pagamentos) ·
[Pagar.me – Pix](https://docs.pagar.me/docs/pix-1) ·
[Stone CONNECT](https://conteudo.stone.com.br/como-conectar-seu-software-na-stone/) ·
[Connect TEF](https://connecttef.com.br/) ·
[Iugu split](https://www.iugu.com/split-pagamentos) ·
[Focus NFe](https://focusnfe.com.br/) ·
[NFS-e Nacional (Tecnospeed)](https://blog.tecnospeed.com.br/api-nfse-nacional-o-que-e-e-como-integrar/) ·
[Prontuário/CFM](https://bydoctor.com.br/blog/prontuario-eletronico-cfm-requisitos-seguranca-certificacao) ·
[SBIS](https://sbis.org.br/certificacoes/certificacao-software/) ·
[WhatsApp API 2026](https://www.socialhub.pro/blog/preco-whatsapp-api-2026-brasil/) ·
[Vertical SaaS](https://www.abseed.com.br/blog/vertical-saas) ·
[Micro SaaS Brasil](https://microsaas.substack.com/p/micro-saas-no-brasil-o-cenario-real)

---

## Pendências deste documento
- [ ] Reconfirmar as afirmações ◐ de pagamento (Asaas/Pagar.me/Stone/Connect TEF) —
      re-rodar verificação após o reset do limite de sessão.
- [ ] Você preencher as colunas **Decisão** (Agora/Depois/Não) das §4–§8.
- [ ] Definir (ou não) verticalização de marketing por nicho (§3).
