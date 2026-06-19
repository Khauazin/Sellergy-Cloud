> ⚠️ **DOCUMENTO HISTÓRICO — produto anterior (chatbot-first).** A direção mudou para
> **ERP-first** em 2026-06-19. Fonte de verdade agora: [erp-pivo.md](erp-pivo.md),
> [erp-arquitetura-e-operacao.md](erp-arquitetura-e-operacao.md) e
> [plano-de-acao-pivo.md](plano-de-acao-pivo.md). Onde houver divergência, **valem os
> documentos do pivô**.

# Sellergy Cloud — O Cérebro do Negócio

> **Documento mestre.** Define por que existimos, para quem, o que entregamos e
> como o agente opera. É a raiz de onde derivam os demais documentos (telas,
> dados/cadastros, LGPD, infraestrutura, painel admin).
>
> **Documento vivo.** Cada afirmação é marcada como **[DECIDIDO]**,
> **[EM DEBATE]** ou **[HIPÓTESE]**. Consolidado em 2026-05-29. Absorve e atualiza
> o `estrategia-bot-vendedor.md` (que passa a ser o detalhamento da frente do
> agente).

---

## Sumário

- **Camada 0 — Fundamento:** por quê / para quem.
- **Camada 1 — Mercado:** como o mercado funciona e onde estamos apontando.
- **Camada 2 — Posicionamento:** proposta de valor e diferencial defensável.
- **Camada 3 — Definição do Produto Lançável:** o que precisa estar pronto pra lançar (o coração).
- **Camada 4 — Produto e Arquitetura Funcional:** os módulos e como se integram.
- **Camada 5 — O Agente:** o cérebro do bot (atender, conduzir, fechar).
- **Camada 6 — Operação e Pessoas:** especialistas, roteamento, permissões.
- **Camada 7 — Retenção e Crescimento:** pós-venda, recompra, campanhas.
- **Camada 8 — Segurança, LGPD e Confiança.**
- **Camada 9 — Métricas e Norte.**
- **Apêndices:** glossário, log de decisões, perguntas em aberto, mapa visão × código, preço (a definir), suíte de documentos.

---

## Camada 0 — Fundamento

### 0.1 Visão
Ser a camada operacional de IA das PMEs brasileiras: o lugar onde o atendimento
no WhatsApp vira venda fechada e a venda vira gestão (agenda, estoque, caixa, CRM)
— sem o dono precisar de cinco ferramentas que não conversam entre si.

### 0.2 Missão
Tirar o trabalho manual repetitivo do dono de PME: o bot atende, conduz e fecha;
o sistema registra e organiza. O dono cuida do negócio, não da operação.

### 0.3 Tese central **[DECIDIDO]**
O mercado tem muitos chatbots, mas **nenhum opera o negócio**. Eles param na
conversa ou em árvores de decisão engessadas. Em 2026 a Meta lançou o Business AI
gratuito, que **comoditizou o "atender"** (FAQ, catálogo, horário).

> O diferencial defensável não é conversar — é **atender → conduzir → fechar →
> operar**, num motor único, com o ERP (CRM + agenda + estoque + caixa +
> financeiro) embaixo do agente.

Concorrente de chatbot teria que construir um ERP; um ERP teria que construir o
agente. Estamos no cruzamento.

### 0.4 O problema real
A PME de serviço ou de produto perde dinheiro em pontos previsíveis:
- **Lentidão de resposta:** o dono está ocupado, o lead espera e vaza pro concorrente.
- **Agenda mal gerida:** marca horário que não existe, gera conflito e no-show.
- **No-show:** ninguém confirma/lembra; a cadeira ou o slot vazio é receita perdida e irrecuperável.
- **Esquece a recompra:** o cliente sumiu e ninguém o trouxe de volta no momento certo.
- **Sem visibilidade:** o dono não enxerga o funil, o caixa nem o estoque em tempo real.

---

## Camada 1 — Mercado

### 1.1 Como o mercado funciona — a jornada **[DECIDIDO]**
Toda PME de atendimento no WhatsApp segue a mesma jornada, e cada etapa tem uma
alavanca de dinheiro:

| Etapa | O que acontece | Alavanca | Onde se perde hoje |
|---|---|---|---|
| Descoberta | cliente vê o negócio e manda "oi, quanto é?" | velocidade de resposta | dono ocupado → demora → lead vaza |
| Qualificação | entender o que precisa | conversão | pergunta genérica, não conduz |
| Apresentação | preço real + horário/produto que existe | ocupação / disponibilidade | oferece o que não tem → retrabalho |
| Fechamento | reservar horário (serviço) ou pedido (produto) | taxa de fechamento | sem CTA claro, lead esfria |
| Pré-atendimento | confirmar / lembrar | **anti no-show** | ninguém lembra → slot vazio |
| Atendimento/Entrega | acontece; pagamento normalmente presencial | ticket | — |
| Pós-venda | agradecer / avaliação | reputação | nada automatizado |
| Recompra | lembrar no momento certo | **LTV — o jogo todo** | dono esquece → cliente vai pro concorrente |

### 1.2 As 5 alavancas que decidem o negócio **[DECIDIDO]**
Velocidade de resposta · taxa de ocupação/disponibilidade · no-show · recompra/LTV
· visibilidade para o dono. Quem mexe nessas cinco, ganha. É onde miramos.

### 1.3 Os três trabalhos do bot **[DECIDIDO]**
O bot não tem um trabalho só. Tem três, e eles se encadeiam num mesmo fluxo:

```
 ENTRADA (cliente manda mensagem — quase sempre uma PERGUNTA)
        │
   [ ATENDER ] ── resolve a dúvida / identifica a intenção
        │
        ├── só dúvida?  → responde bem (e guarda o lead)
        └── tem venda?  → CONDUZ o funil
                            ├── SERVIÇO  → agenda
                            └── PRODUTO  → pedido
                                  │
                               FECHA → OPERA (agenda/estoque/caixa/CRM) → PÓS / RECOMPRA
        │
   [ HANDOFF ] ── não sabe resolver → passa pra um humano
```

**Insight central:** atender é o topo do funil, não uma função separada. "Vocês
fazem corte?" / "tem essa camiseta no P?" é uma oportunidade de venda. O bom bot
transforma dúvida em venda.

### 1.4 Panorama competitivo **[DECIDIDO — pesquisa de 2026-05-28]**

| Player | Origem | Foco | Fecha venda? | Integra gestão? |
|---|---|---|---|---|
| BotConversa | BR | Fluxos WhatsApp PME | Parcial, sem checkout | Não nativo (Zapier) |
| Leadster | BR | Captura/qualificação | Não, passa p/ humano | Não |
| Blip (Take) | BR | Conversacional enterprise | Depende de integração | Via projeto |
| Zenvia | BR | CPaaS/campanhas | Não nativo | Não |
| Huggy | BR | Omnichannel | Não nativo | Via integração |
| ManyChat | Global | Marketing IG/WA | Parcial | Não |
| Kommo (amoCRM) | Global | CRM + WA + IA | No CRM, sem checkout in-chat | CRM sim; ERP não |
| WATI | Global | Inbox + chatbot | Parcial (catálogo) | Não |
| Tidio/Lyro, Intercom Fin | Global | Suporte com IA | Não (suporte) | Não |

### 1.5 O buraco confirmado **[DECIDIDO]**
Ninguém entrega, num pacote nativo, *atendimento + venda fechada no WhatsApp +
baixa de estoque + lançamento no caixa + agenda + CRM* para PME física BR. O
diferencial divide-se em pedágio e fosso:

| Função | Status no mercado | Para nós |
|---|---|---|
| **Atender** (FAQ, dúvida, horário) | comoditizado (Meta Business AI grátis) | **obrigatório**, mas é o pedágio de entrada — não o diferencial |
| **Conduzir + fechar** (serviço/produto) | ninguém faz integrado | **fosso** |
| **Operar** (agenda/estoque/caixa/CRM) | ninguém faz | **fosso** |

Tradução: o atendimento nos coloca no jogo; ganhamos no que acontece **depois da
resposta**. O Meta AI responde e para; nós respondemos, conduzimos, fechamos e
operamos.

### 1.6 Timing — sinais de 2026 **[DECIDIDO]**
- **Meta Business AI gratuito** para PME no Brasil → comoditiza o "atender".
- **Pagamento BR (jan/2026):** cartão direto saiu; valem **Pix, boleto e link de
  pagamento**. Qualquer checkout in-chat futuro gira em torno de Pix + link.
- **Cobrança WhatsApp (desde jul/2025):** por mensagem, por categoria (Marketing /
  Utility / Service grátis na janela de 24h). Impacta o custo de campanhas.

### 1.7 ICP — perfil do cliente ideal **[DECIDIDO]**
PME física brasileira, atendida no WhatsApp, nos três sabores:
- **Serviço com agenda:** salão, barbearia, clínica, estética. Venda = agendamento.
- **Produto:** loja, boutique. Venda = pedido. Recompra = reposição/novidade.
- **Híbrido:** clínica que vende cosmético, salão que vende produto. Os dois.

### 1.8 Dimensão de mercado **[HIPÓTESE — a estimar]**
TAM/SAM/SOM ainda não calculados. Placeholder honesto: estimar nº de PMEs de
serviço + varejo físico no BR com WhatsApp ativo, ticket médio e disposição a pagar
SaaS. Fica para uma rodada de pesquisa dedicada (não bloqueia o lançamento).

---

## Camada 2 — Posicionamento

### 2.1 Proposta de valor única **[DECIDIDO]**
> Um **atendente de IA** para PME que **tira a dúvida, conduz e fecha** —
> agendamento (serviço) ou pedido (produto) — e a venda já cai em agenda, estoque,
> caixa e CRM. O dono vê tudo num painel.

### 2.2 Diferencial defensável (o fosso) **[DECIDIDO]**
O sistema de gestão embaixo do bot. Não vendemos um chatbot; vendemos a operação
do negócio acontecendo sozinha. Replicar exige construir as duas metades (agente +
ERP) e integrá-las — barreira alta.

### 2.3 Posicionamento vs. categorias **[DECIDIDO]**
- **vs. Chatbot de fluxo:** eles conversam; nós operamos.
- **vs. CRM de venda:** eles organizam; nós executamos (agenda real, caixa, estoque).
- **vs. App de agendamento:** eles marcam; nós conversamos, vendemos e gerimos.
- **vs. ERP/e-commerce:** eles focam produto e exigem ERP externo; nós nascemos integrados e atendemos serviço físico.
- **vs. Meta Business AI:** ele atende e para; nós atendemos e fechamos.

### 2.4 Narrativa / frase-norte
"Seu melhor atendente trabalha 24h, nunca esquece de cobrar a recompra e já lança
tudo no sistema."

---

## Camada 3 — Definição do Produto Lançável (o coração)

### 3.1 Princípio de escopo **[DECIDIDO]**
O lançamento (v1) cobre **os dois segmentos (serviço e produto) + atendimento**,
sustentado por **um motor único + perfis de segmento (preset)**. Não construímos
três bots; construímos um agente cujas tools e prompt são configurados pelo
segmento do tenant.

### 3.2 Tabela mestra — buraco → capacidade → entrega **[DECIDIDO, salvo onde marcado]**
É esta tabela que define "o que precisa estar pronto pra dizer que atendemos por
completo o que os concorrentes deixaram".

| # | Buraco do mercado | Capacidade que entrega | Módulo / feature | Existe hoje? | Lançamento |
|---|---|---|---|---|---|
| 1 | bot conversa mas não agenda de verdade | agenda com capacidade real | `Especialista` + jornada + tool `agenda.listarHorariosLivres` | **Não** | **v1** |
| 2 | agenda sem profissional/conflito | alocar o profissional certo e livre | `Agendamento.especialistaId` + algoritmo de menor carga | **Não** | **v1** |
| 3 | cadeira/slot vazio por esquecimento | confirmação e lembrete automáticos | cron de lembrete + status `CONFIRMED` | Não (só crons de caixa/relatório) | **v1** |
| 4 | bot não responde dúvida do jeito do negócio | atender com conhecimento do tenant | **base de conhecimento/FAQ** + puxa catálogo/horário | **Não** | **v1** |
| 5 | bot não sabe quando atender vs. vender | decidir a cada mensagem | **orquestrador de intenção** no agente | **Não** | **v1** |
| 6 | venda de produto não baixa estoque/caixa | fechar pedido integrado | fluxo de pedido + `vendas.lancarVenda` → estoque + caixa | Parcial (`Venda`, `MovimentacaoEstoque` existem) | **v1** |
| 7 | catálogo desorganizado | produtos/variações com preço e estoque | `Produto`/`VariacaoProduto` | **Sim** (ajustar) | **v1** |
| 8 | dono sem controle do tipo de negócio | telas/tools certas por sabor | **segmento estruturado** (Serviço/Produto/Híbrido) | Não (`Cliente.segmento` é texto livre) | **v1** |
| 9 | lead não anda no funil | mover o lead automaticamente | CRM/etapas (Kanban) | **Sim** (ajustar) | **v1** |
| 10 | webhook reenviado duplica venda/agendamento | idempotência | chave idempotente por evento/tool | **Não** (risco aberto) | **v1 (obrigatório)** |
| 11 | bot esquece o que o cliente disse | memória + extração estruturada | resumo de conversa + persistir dados no lead/agendamento | Parcial (janela ~20 msgs) | **v1** |
| 12 | dono não confia em bot sem saída | passar pra humano | handoff mínimo + alertar atendente | Não (inbox é placeholder) | **v1 (mínimo)** |
| 13 | cliente some e ninguém traz de volta | recompra no momento certo | follow-up por cadência de segmento | Não (campanhas é placeholder) | **v1 leve [EM DEBATE]** |
| 14 | suporte que mexe em agenda (remarcar/cancelar) | resolver com segurança | suporte transacional com alçada + confirmação | Não | **[EM DEBATE]** |

### 3.3 Checklist de "atender por completo" (v1)
O v1 só pode ser chamado de completo quando, ponta a ponta, o bot consegue:
1. Atender uma dúvida usando o conhecimento do tenant (FAQ + catálogo + horário).
2. Identificar intenção e decidir entre atender, vender ou escalar.
3. Conduzir a venda de **serviço** até agendar com especialista e horário reais.
4. Conduzir a venda de **produto** até fechar o pedido, baixando estoque e caixa.
5. Confirmar/lembrar o agendamento (anti no-show).
6. Mover o lead no funil e persistir os dados importantes da conversa.
7. Passar pra um humano quando não souber resolver.
8. Fazer tudo sem duplicar venda/agendamento (idempotência) e dentro da LGPD.

### 3.4 Fora do v1 — não-escopo explícito **[DECIDIDO]**
Para o lançamento não estourar, ficam para a fase 2:
- **Checkout in-chat com pagamento (Pix/link):** no v1 o pagamento é presencial. *(Pricing será detalhado só no fim — Apêndice E.)*
- **Campanhas em massa / disparo de templates HSM.**
- **Inbox completa multiatendente** (no v1 entra só o handoff mínimo).
- **Sub-presets por sub-tipo** (clínica × salão × barbearia variando prompt/cadência) — no v1, um perfil Serviço único com campo de cadência.

---

## Camada 4 — Produto e Arquitetura Funcional

### 4.1 Os módulos e como se integram
- **CRM:** leads, etapas (Kanban), histórico, produtos de interesse.
- **Agenda:** agendamentos, especialistas, jornada, capacidade. *(a evoluir)*
- **Catálogo:** produtos e variações (preço, custo, estoque, duração de serviço).
- **Estoque:** movimentações; integra com venda e financeiro.
- **Vendas/Caixa:** vendas numeradas, sessão de caixa (manual e automática do bot).
- **Financeiro:** lançamentos, contas a pagar, DRE, relatórios mensais.
- **Conhecimento (novo):** FAQ/base por tenant que alimenta o atendimento.
- **Bot/Engine:** fluxos visuais + agente IA com tools que tocam todos os módulos.

A integração é o produto: uma venda fechada pelo bot dispara, em cadeia, baixa de
estoque + lançamento no caixa + avanço do lead no funil.

### 4.2 Motor único + perfis de segmento (preset) **[DECIDIDO]**
Um só agente. O método de venda (atender → descoberta → apresentação →
fechamento → pós) é o mesmo para todos. O **segmento** é um preset que preenche:
tools ativas, CTA de fechamento, cadência de recompra e prompt base. Configuração,
não código duplicado.

### 4.3 Segmentação estruturada **[DECIDIDO]**
Migrar `Cliente.segmento` de texto livre → enum estruturado **Serviço / Produto /
Híbrido**, definido pelo admin ao criar o tenant. O segmento controla telas
visíveis (ex.: "Especialista" só aparece em Serviço), tools do bot e módulos
auto-ativados. Princípio: escolher o segmento já configura o essencial.

### 4.4 Roadmap por fases
- **Fase 1 — v1 (lançamento):** os dois segmentos + atendimento, conforme Camada 3.
- **Fase 2:** checkout in-chat (Pix/link), campanhas, inbox multiatendente, sub-presets.
- **Fase 3:** otimizações de IA (memória longa, recomendação), multicanal ampliado.

---

## Camada 5 — O Agente (o cérebro do bot)

### 5.1 Filosofia **[DECIDIDO]**
O bot não responde: **conduz**. A cada interação ele tem um objetivo (avançar o
lead ou resolver a dúvida), não só devolver texto.

### 5.2 Orquestrador de intenção **[DECIDIDO — a construir]**
A cada mensagem, o agente classifica e decide: **atender** (dúvida informacional),
**vender** (há intenção de compra → entra no funil do segmento), ou **escalar**
(não sabe resolver / pediu humano / ação fora da alçada). Atender e vender se
misturam num mesmo diálogo — a classificação é contínua, não uma vez só.

### 5.3 Método de venda — funil no CRM **[DECIDIDO]**
```
 ATRAÇÃO → DESCOBERTA → APRESENTAÇÃO → FECHAMENTO → PÓS-VENDA
 Novo → Em contato → Qualificado → Em negociação → Proposta enviada → Fechado-Ganho
```
O bot move o lead pelas etapas e registra cada avanço; o dono vê a máquina de
vendas trabalhando no Kanban.

### 5.4 Perfis de segmento — o que cada preset ativa **[DECIDIDO]**

| Aspecto | Perfil Serviço | Perfil Produto | Híbrido |
|---|---|---|---|
| CTA de fechamento | agendar ("reservo seu horário?") | pedido ("fecho seu pedido?") | conforme o item |
| Tools-chave | `agenda.*`, `catalogo.*`, `crm.*` | `catalogo.*`, `vendas.lancarVenda`, `crm.*` | união das duas |
| Campos sempre extraídos | nome, serviço, data/hora, especialista, observações críticas (alergia) | nome, item/variação, quantidade, forma de entrega | conforme intenção |
| Cadência de recompra | salão/barbearia ~30d; clínica ~6m | reposição/novidade (configurável) | por item |
| Conhecimento | FAQ + catálogo + horário + jornada | FAQ + catálogo + estoque | tudo |

### 5.5 Camada de conhecimento / FAQ **[EM DEBATE — recomendação abaixo]**
O bot precisa de uma fonte de verdade do tenant para atender. **Recomendação para
o v1:** FAQ livre (pares pergunta/resposta editáveis pelo dono) + puxa
automaticamente catálogo, horário de funcionamento e jornada. Sem RAG/embeddings no
v1 (fica para fase 2 se o volume justificar).
> *Decisão pendente: confirma FAQ livre + auto-pull no v1, ou algo mais simples?*

### 5.6 Catálogo de tools por perfil **[DECIDIDO — listarHorariosLivres a construir]**
- `mensagens.enviar` — responder no canal.
- `crm.criarLead`, `crm.moverEtapa` — funil.
- `catalogo.buscarProduto`, `catalogo.listarProdutos` — preço/itens reais.
- `agenda.listarHorariosLivres` *(novo)*, `agenda.criarAgendamento` — serviço.
- `vendas.lancarVenda` — produto (baixa estoque + caixa).
- `conhecimento.buscar` *(novo)* — FAQ do tenant.
Regra de habilitação dupla (já existe): a tool só roda se o módulo está liberado
para o tenant **e** habilitada no bot.

### 5.7 Guardrails e alçada **[EM DEBATE em parte]**
- **Ações que mexem em dinheiro/estoque exigem confirmação explícita do cliente**
  ("repito o resumo e peço o sim") antes de executar.
- **Suporte transacional (remarcar/cancelar):** **recomendação v1** — o bot
  *remarca* com confirmação e dentro da alçada; *cancelamento* → handoff humano.
  > *Decisão pendente: remarcação pelo bot entra no v1 ou só informa e humano faz?*
- **Desconto:** o bot não concede desconto fora de regra configurada. *(regra a definir)*
- **Limites de alçada:** valor máximo de venda automática, horários permitidos.
- **Toda ação registrada** em `auditoria_acoes_agente`.

### 5.8 Memória e contexto **[DECIDIDO — a reforçar]**
- O histórico tem janela limitada (~20 mensagens) → conversa longa perde o começo.
- **Solução:** resumo da conversa + **estado estruturado persistido** em
  `Conversa.estado`. O agente extrai dados importantes (data desejada, alergia,
  item de interesse) e **salva no lead/agendamento** — nunca confia só no chat.

### 5.9 Idempotência e resiliência **[DECIDIDO — obrigatório no v1]**
A Meta reenvia webhooks e a IA pode chamar a mesma tool duas vezes. Sem chave
idempotente, duplica venda/agendamento. Necessário: chave idempotente por evento
de entrada e por ação de escrita + retry/dead-letter para execuções que falham.

### 5.10 Esqueleto do system prompt base **[EM DEBATE — só esqueleto por ora]**
Estrutura, não o texto final: papel e tom (por segmento) · objetivo (conduzir o
funil) · regras duras (nunca prometer preço sem buscar no catálogo; oferecer até 3
horários; confirmar antes de mexer em dinheiro/estoque; escalar quando não souber)
· dados a sempre extrair · formato de resposta · limites de alçada.
> *Detalhamento (rascunho completo do prompt) fica para o documento do agente.*

---

## Camada 6 — Operação e Pessoas

### 6.1 Especialista — recurso agendável **[DECIDIDO — a construir]**
Novo conceito `Especialista` por tenant (nome, ativo). Cada especialista declara
**quais serviços executa** (M:N) e tem **jornada própria** (dias/horários),
herdando o expediente da loja por padrão. Capacidade num horário = nº de
especialistas aptos ao serviço e livres. Barbearia (todos fazem tudo) é o caso
particular. Rótulo exibido configurável por tenant (ideia futura).

### 6.2 Especialista ≠ Usuário **[DECIDIDO]**
Entidades separadas, vínculo 1:1 opcional (`Especialista.usuarioId` nullable):
barbeiro que só atende (sem login), secretária que só loga (sem atender), dentista
que faz os dois.

### 6.3 Roteamento e alocação **[DECIDIDO]**
- O vínculo está no **serviço**: cada especialista declara os serviços que faz.
- **O bot decide** o especialista no MVP (cliente não escolhe um específico).
- **Algoritmo:** entre os aptos e livres no horário, escolhe o de **menor carga no
  dia** (balanceamento). Empate → qualquer. Ninguém livre → oferece próximos horários.
- *Revisão futura:* permitir "quero com a Dra. Ana" quando houver demanda.

### 6.4 Permissões — módulo MENSAGENS + escopo **[DECIDIDO]**
Novo módulo de permissão `MENSAGENS` com dimensão de **escopo**: ver "próprias"
(conversas onde é responsável) vs. "todas". Os módulos atuais só têm
visualizar/criar/editar/excluir; Mensagens precisa do escopo a mais. "Secretária"
= papel montado por permissão (ver todas + responder), não perfil novo no enum.

### 6.5 Inbox e handoff **[v1 = handoff mínimo]**
No v1: o bot escala para humano (alerta + atribuição da conversa). Inbox completa
multiatendente fica para a fase 2. `Conversa` ganha responsável
(`especialistaId`/`usuarioId`) para roteamento e filtro de acesso.

---

## Camada 7 — Retenção e Crescimento

### 7.1 Pós-venda e recompra **[v1 leve — EM DEBATE]**
Após Fechado-Ganho, agendar follow-up. Gatilhos por segmento: salão (~30d), clínica
(~6m), produto (reposição/novidade). **Recomendação v1:** follow-up simples por
cadência (lembrete), sem campanhas em massa.
> *Decisão pendente: recompra mínima entra no v1 ou fica fase 2? E o disparo é
> automático ou sugerido pro dono aprovar?*

### 7.2 Reativação de leads parados
Já há "leads parados" no relatório de CRM — usar como gatilho de reativação.

### 7.3 Campanhas **[fase 2]**
Greenfield. Restrições da Meta a respeitar: janela de 24h (resposta livre), fora
dela só template HSM aprovado, cobrança por mensagem por categoria. Tipos previstos:
reativação, recompra/retorno, promoção segmentada, aniversário, atendimento
abandonado, pós-venda. Estrutura: segmento (quem) + gatilho (quando) + mensagem
(o quê) + objetivo (mover etapa/vender) + medição.

---

## Camada 8 — Segurança, LGPD e Confiança

### 8.1 Isolamento multi-tenant **[DECIDIDO — existe]**
Tudo filtra por `clienteId`. Toda nova entidade nasce com escopo de tenant.

### 8.2 Cifra em repouso **[DECIDIDO — existe]**
Mensagens e credenciais cifradas com AES-256-GCM (ciphertext + IV + tag +
versão de chave). Credenciais de provedores externos (IA, canais) nunca em texto puro.

### 8.3 LGPD **[EM DEBATE — detalhar no doc de conformidade]**
Pontos a fechar no documento dedicado (doc #4 da suíte):
- **Base legal** para tratar dados do cliente final (telefone, nome, CPF, nascimento).
- **Consentimento** e aviso de que a conversa é registrada.
- **Minimização:** coletar só o necessário ao atendimento/venda.
- **Retenção:** prazo por tipo de dado; mensagens têm retenção configurável por fluxo.
- **Direitos do titular:** acesso, correção, eliminação; como atender pedidos.
- **Seu acesso a dados sensíveis (mensagens):** definir quem acessa, com auditoria
  (já existe `auditoria_mensagens`) e necessidade legítima.

### 8.4 Auditoria **[DECIDIDO — existe]**
Append-only de ações do agente (`auditoria_acoes_agente`), de leitura/escrita de
mensagens (`auditoria_mensagens`) e de mudanças em agendamento/financeiro (histórico
com snapshot de quem fez).

---

## Camada 9 — Métricas e Norte

### 9.1 North Star Metric **[HIPÓTESE]**
Candidata: **vendas fechadas pelo bot por tenant/mês** (agendamentos + pedidos
confirmados). Mede diretamente "o bot vende", que é a tese.

### 9.2 KPIs por camada
- **Negócio:** tenants ativos, retenção/churn, receita por tenant.
- **Produto:** ativação (tenant com bot publicado), uso (conversas/dia), módulos ativos.
- **Agente:** taxa de fechamento, % de conversas resolvidas sem humano, no-show evitado, recompra disparada.

### 9.3 Como medir "o bot vende de verdade"
Funil do agente: conversas → leads qualificados → propostas (horário/pedido
oferecido) → fechados. Conversão entre etapas revela onde o bot trava.

---

## Apêndices

### Apêndice A — Glossário
- **Especialista:** recurso agendável (profissional) que executa serviços; pode ou não ter login.
- **Perfil de segmento:** preset (Serviço/Produto/Híbrido) que configura tools, CTA, cadência e prompt.
- **Alçada:** limite do que o bot pode fazer sozinho antes de exigir confirmação ou humano.
- **Handoff:** passagem da conversa do bot para um atendente humano.
- **Idempotência:** garantia de que processar o mesmo evento duas vezes não duplica efeito.

### Apêndice B — Log de decisões
| Data | Decisão |
|---|---|
| 2026-05-28 | Tese e diferencial validados; método de venda mapeado no funil do CRM. |
| 2026-05-28 | Pesquisa de mercado: ninguém une venda no WhatsApp + ERP + CRM p/ PME física BR. Meta comoditizou o "atender". |
| 2026-05-28 | Especialistas como recurso agendável; jornada por especialista; tool `listarHorariosLivres` a criar. |
| 2026-05-28 | Especialista ≠ Usuário (vínculo opcional); Mensagens = módulo com escopo; secretária via permissão. |
| **2026-05-29** | **Lançamento cobre os DOIS segmentos (Serviço + Produto)** — supera a decisão de 28/05 de "MVP só serviço". |
| **2026-05-29** | **O bot também atende (resolve dúvidas/problemas):** adicionada a função "atender" como topo do funil + camada de conhecimento/FAQ + orquestrador de intenção. |
| **2026-05-29** | **Preço/cobrança fica para o fim** (Apêndice E); não bloqueia o lançamento. |
| **2026-05-29** | Definida a suíte de documentos (Apêndice F): este → telas → dados/cadastros → LGPD → infra/segurança → painel admin. |
| **2026-05-29** | **WhatsApp-only:** removidas as integrações Telegram/Instagram/Website (código, UI e enums `Canal`/`TipoCredencial`). Foco total no WhatsApp. |
| **2026-05-29** | **Builder do bot inspirado no n8n, porém fácil:** poder de fluxos sem processo excessivo. n8n é referência de funções; UX simples é princípio inegociável. |

### Apêndice C — Perguntas em aberto (consolidado)
1. **Base de conhecimento (5.5):** FAQ livre + auto-pull no v1, ou mais simples?
2. **Suporte transacional (5.7):** remarcação pelo bot no v1 ou só humano?
3. **Recompra (7.1):** v1 leve ou fase 2? Disparo automático ou aprovado pelo dono?
4. **Desconto (5.7):** o bot pode? Sob qual regra?
5. **Alçada de venda automática:** valor mínimo/máximo, horários permitidos?
6. **Dimensão de mercado (1.8):** rodar estimativa TAM/SAM/SOM quando?

### Apêndice D — Mapa visão × código atual (o gap a construir)
| Capacidade decidida | Estado no código |
|---|---|
| `Especialista` + M:N com serviços + jornada | **não existe** |
| `Agendamento.especialistaId` + alocação | `Agendamento` é plano (sem profissional/capacidade) |
| tool `agenda.listarHorariosLivres` | **não existe** |
| Lembrete/confirmação de agendamento (cron) | só há crons de caixa e relatório mensal |
| Base de conhecimento / FAQ | **não existe** (só prompt + variáveis do bot) |
| Orquestrador de intenção | **não existe** explicitamente |
| Segmento estruturado | `Cliente.segmento` é `String?` livre |
| `Conversa` com responsável + escopo | `Conversa.estado` existe; sem responsável |
| Módulo de permissão `MENSAGENS` + escopo | inbox é placeholder |
| Idempotência de webhook/tools | **risco aberto** |
| Memória de conversa | janela ~20 msgs (sem resumo persistido) |
| Venda de produto → estoque + caixa | `Venda`/`MovimentacaoEstoque`/`Lancamento` existem; fluxo pelo bot a fechar |

### Apêndice E — Modelo de negócio e preço **[A DEFINIR — no fim]**
Planos `BASIC`/`PRO`/`PREMIUM` já existem no schema. Lógica de cobrança
(mensalidade + eventual repasse de custo de IA/WhatsApp) e unit economics serão
detalhados ao final, conforme decisão de 2026-05-29.

### Apêndice F — Suíte de documentos (o programa)
1. **Cérebro do Negócio** (este).
2. **Mapa de Telas e Fluxos** (app do tenant + painel admin).
3. **Modelo de Dados e Cadastros** (entidades, campos, validações, dados transcritos da conversa).
4. **Conformidade LGPD** (base legal, consentimento, retenção, direitos).
5. **Infra, Segurança e Retenção de Dados** (servidor, banco, acúmulo, acesso a mensagens).
6. **Especificação do Painel Admin** (gestão da plataforma + criação de bots).
