> ⚠️ **DOCUMENTO HISTÓRICO (chatbot-first).** A direção mudou para **ERP-first**
> (2026-06-19). As **regras de sinal/pagamento** aqui continuam úteis e alimentam o módulo
> de Pagamentos do pivô, mas a moldura de bot/agente é histórica. Fonte de verdade:
> [erp-arquitetura-e-operacao.md](erp-arquitetura-e-operacao.md) §4 (Pagamentos).

# Sellergy — Fluxo de Atendimento e Pagamento

> **Operacional.** Cobre dois fluxos críticos do dinheiro: (1) o ciclo
> agendar → atender → fechar a venda, e (2) a cobrança de **sinal** (depósito)
> com link de pagamento. Deriva do [cérebro](cerebro-do-negocio.md) — onde o
> *checkout in-chat (Pix/link)* já está marcado como **fase 2**. Iniciado em
> 2026-06-01.

---

## 1. Ciclo do serviço: agendar → atender → fechar a venda  **[EM DECISÃO]**

**Princípio:** serviço só vira receita quando **acontece**. Por isso o bot, ao
agendar um serviço, **não cria venda** — cria só o **compromisso**. A venda nasce
no atendimento. (Produto é diferente: o bot lança a venda na hora.)

```
SERVIÇO:  bot agenda → Agendamento PENDING  ──(atendimento)──►  Venda
PRODUTO:  bot fecha  → Venda na hora
```

Se a venda nascesse no agendamento, **todo no-show viraria receita fantasma** —
quebraria caixa e relatório.

### "Concluir atendimento" (na agenda do especialista)
Cada agendamento ganha duas ações:

- **✅ Concluir atendimento** → numa transação:
  1. marca o agendamento como **COMPLETED**;
  2. **cria a Venda** do serviço (valor = preço, descrição = serviço, vinculada
     ao lead **e ao especialista**);
  3. dispara o **lançamento no financeiro/caixa** (integração que já existe);
  4. pede o **método de pagamento** (presencial);
  5. a venda guarda **quem concluiu** (`criadoPorId`) — semente da autoria/imutabilidade.
- **❌ Não compareceu** → marca **CANCELED**, **sem venda** (no-show não vira receita).

**Decisões pendentes de confirmação:**
- (a) Venda nasce **ao concluir**, não ao agendar. *(recomendado)*
- (b) Ao concluir, pedir método de pagamento e marcar pago (entra no caixa) — ou deixar "a receber".
- (c) O **especialista** conclui/dá baixa nos próprios atendimentos (sem exigir o módulo Vendas) — ou só caixa/recepção.

---

## 2. Sinal (depósito) + confirmação por pagamento  **[EM ESTUDO — fase 2, sem código]**

### O problema/risco (levantado pelo usuário)
O bot fechar venda/agendamento **sem cobrar e sem confirmar** é risco: no-show,
venda fantasma, caixa que não bate. A clínica quer cobrar um **sinal** antes da
consulta; o bot manda um **link de pagamento**, e a venda/agendamento só
**confirma com o pagamento** (ou com a confirmação do sinal). Vale pra **serviço
e produto**.

### Estudo de mercado (síntese — conhecimento até jan/2026 + contexto BR do cérebro)
1. **Sinal anti-no-show** — padrão em clínica/salão/estética: cobra um valor
   parcial pra confirmar. Combate o no-show (a alavanca #1 de receita perdida).
   Formatos comuns: **percentual** (30–50%) ou **valor fixo** (R$ 20–50).
   No-show → sinal não devolvido (ou vira crédito).
2. **Link de pagamento / Pix no WhatsApp** — o negócio manda um link (Pix
   copia-e-cola/QR, ou link de PSP: Mercado Pago, Asaas, PagBank, InfinitePay);
   o cliente paga; o sistema confirma via **webhook** do provedor. No BR o **Pix**
   domina (instantâneo, taxa baixa/zero, confirma na hora). *(Cartão direto saiu
   do BR em jan/2026 — cérebro 1.6.)*
3. **Confirmação é um ESTADO** — o agendamento/pedido fica "aguardando pagamento"
   até o webhook confirmar; só então "confirmado". Sem pagar em X min → **expira**
   e libera o horário/estoque. Isso mata o "fechou sem cobrar".
4. **Parcial vs total** — serviço: sinal agora + resto no atendimento. Produto:
   pré-pago total **ou** sinal pra encomenda/reserva.
5. **Quem cobra** — o diferencial é o **bot enviar o link automático ao fechar**
   (in-chat), não o atendente manual.

### A regra (DECIDIDA — 2026-06-01)

**Forma de pagamento — link multimétodo (resolve o cartão).** O bot **não manda
só Pix**: manda um **link de pagamento de um PSP** (Mercado Pago, Asaas, PagBank,
InfinitePay…) cujo checkout aceita **Pix, cartão de crédito e boleto** — o cliente
escolhe. O PSP processa o cartão e avisa por **webhook**. Cobre quem quer cartão
sem a gente virar adquirente. (PSP específico se decide no build — fase 2.)

**Configuração — por serviço/produto (não global).** Cada item do catálogo define
o seu: `exigeSinal? · tipo (% ou R$ fixo) · valor · prazoReserva (min)`.
- **Serviço:** pode exigir **sinal** (parcial).
- **Produto:** sempre **valor total, sem sinal** (paga tudo pra confirmar o pedido).

**Fluxo do serviço com sinal:**
1. o bot cria o agendamento como **RESERVADO** (provisório — segura o horário, mas **não bloqueia firme**);
2. manda o **link de pagamento** (Pix/cartão/boleto) do **sinal**;
3. **webhook confirma → CONFIRMADO**; o sinal vira **pagamento parcial** e fica
   **abatido do valor cheio** — no atendimento, o cliente paga só o **restante**;
4. **pagamento manda (prioridade):** se outro cliente **pagar** o mesmo horário
   antes, ele **confirma e fica com o horário**; o que estava só **RESERVADO** (sem
   pagar) é **reencaixado em outro horário**, e o **bot explica** isso pra ele e
   oferece os próximos livres;
5. **no atendimento (concluir):** cobra o **restante** (cheio − sinal) e fecha a venda total.

**Produto:** mesmo link de pagamento, mas cobra o **total**; só confirma o pedido com o pagamento.

> **Regra de ouro:** quando há cobrança (sinal no serviço, total no produto), **o
> bot nunca confirma sem o pagamento**. RESERVADO ≠ confirmado; **pagamento manda**.

**Implicação na disponibilidade:** como RESERVADO não bloqueia firme, o
`listarHorariosLivres` deve tratar só **CONFIRMADO/pago** como ocupado — um slot
apenas reservado continua ofertável a quem paga (a trava de duplo-agendamento da
1.7b passa a valer pro confirmado, não pro reservado).

### Por que é fase 2 (não codar agora)
Precisa de **integração com provedor de pagamento** (Pix/link + **webhook
idempotente** + conciliação + estados de expiração). É exatamente o **checkout
in-chat (Pix/link)** que o cérebro já decidiu ser **fase 2**. Então: regra
desenhada agora; construção quando entrarmos no checkout. Na hora de construir,
escolher/validar o PSP (Pix direto via PSP, Mercado Pago, Asaas…) com pesquisa ao vivo.

### Decisões (2026-06-01)
- **Pagamento:** link de PSP **multimétodo** (Pix + cartão + boleto) — não Pix puro.
- **Sinal por item** do catálogo (cada serviço/produto tem o seu); **nada de padrão global**.
- **Sinal pago = confirmação** + valor **abatido** do total (paga o restante no atendimento).
- **Sem pagar = RESERVADO** (provisório, não bloqueia firme). **Quem paga primeiro leva**;
  o reservado é **reencaixado** em outro horário, com o **bot explicando**.
- **Produto = total, sem sinal.**

### No-show com sinal pago (DECIDIDO — 2026-06-01)
Quando o cliente **pagou o sinal e não compareceu**:
1. o sistema dispara um **alerta** ("cliente pago não compareceu");
2. o **bot avisa o cliente** (está agendado e pago) e oferece **duas opções**:
   - **Remarcar** em outra data (reaproveita o sinal já pago), ou
   - **Solicitar reembolso** → o bot **encaminha pra recepção/vendedor** (humano).
3. O reembolso é feito no módulo **Vendas**, por um **sistema de reembolso** —
   e **só usuário com permissão** pode reembolsar (entra nas permissões/alçada).

> Frente nova: **reembolso em Vendas** (estado de estorno + reversão no caixa/financeiro
> + permissão). Anda junto com o checkout (fase 2).

---

## 3. Confirmação, baixa e lembrete  **[DECIDIDO — 2026-06-01]**

- **Estoque baixa só na venda CONFIRMADA.** Reserva/pendente **não mexe no estoque**;
  o decremento acontece quando a venda confirma (produto pago).
- **Serviço tem dois modos de confirmar** (vem da regra do **próprio serviço**, no catálogo):
  - **Com sinal** → confirma **após o pagamento** do sinal (seção 2);
  - **Sem sinal** → confirma normal (presencial), como hoje; cobra no atendimento.
- **Lembrete (pós-agendamento):** no dia da consulta o bot **dispara um aviso ao
  cliente** ("sua consulta é hoje às X"). Combate no-show. Usa a base de Notificações
  (sino + e-mail), com opt-in nas Configurações.

---

## 4. Onde vivem os parâmetros  **[DECIDIDO — 2026-06-01]**

**Princípio:** cada parâmetro mora **onde o usuário pensa naquilo** (contexto);
**Configurações guarda só o transversal/global**. Não jogar tudo numa tela de
Configurações — vira um depósito que ninguém acha nada.

| Parâmetro | Onde vive |
|---|---|
| Sinal do serviço/produto (exige? · %/R$ · prazo) | no **item do Catálogo** |
| Jornada do especialista · serviços que faz | na **ficha do Especialista** |
| Prompt · FAQ · guardrails · cadência · handoff do bot | na **config do Bot** |
| Permissões (quem reembolsa, quem exclui crítico, escopo) | na **Equipe/Usuários** |
| Expediente da loja | **Configurações** (global do tenant) |
| Avisos: ligar/desligar por tipo · app/e-mail | **Configurações** (preferência) |
| Integrações: PSP de pagamento · WhatsApp | **Configurações / Admin** |

Resumo: **distribuído por contexto**; Configurações = expediente + avisos +
integrações + preferências globais.
