# Integrações pendentes — estrutura e o que falta para destravar

> **Fonte de verdade dos itens bloqueados por dependência externa** (chave de
> provedor de pagamento, aprovação da Meta). Cada item traz: o que é, o que
> falta, **onde encaixa no código que já existe** e o **fallback do v1**. Quando
> a credencial/aprovação chegar, a integração é mecânica — a estrutura interna
> já está pronta. Consolidado em 2026-06-02.

---

## Princípio

Nada aqui depende de "mais código de produto" — depende de **conta/chave/aprovação
de terceiro**. Por isso ficam como estrutura + avisos, conforme decidido
("forma de pagamento só no final"; Embedded Signup como concierge no MVP). O
sistema opera 100% sem eles no v1; eles **ampliam** o alcance, não destravam o
core.

---

## 1. Sinal / Checkout (link de pagamento PSP) — *fase 2*

**O que é.** Bot envia um link de pagamento multimétodo (Pix + cartão + boleto)
para cobrar o **sinal** de um agendamento ou o **total** de um pedido. Pagamento
confirmado → confirma o agendamento/venda automaticamente. Regra de negócio já
desenhada em [`fluxo-atendimento-e-pagamento.md`](fluxo-atendimento-e-pagamento.md)
(sinal abate no total, reserva com prioridade de quem paga primeiro, etc.).

**O que falta (externo).**
- Conta em um **PSP** (Mercado Pago, Asaas, Stripe, Pagar.me…) com suporte a Pix
  + cartão + boleto num único link/checkout.
- **Chave de API** do PSP + **webhook de confirmação** de pagamento.

**Onde encaixa (interno, já pronto).**
- **Credencial:** o cofre cifrado já suporta um tipo novo sem migração de schema —
  basta adicionar `MERCADO_PAGO`/`PSP_API_KEY` ao enum `TipoCredencial`
  (`schema.prisma`) e ao `SCHEMA_POR_TIPO`/`TIPOS_VALIDOS` em
  [`credenciais.routes.js`](../backend/src/routes/credenciais.routes.js). Pode ser
  credencial de **plataforma** (admin) ou por tenant — a infra de ambos já existe
  ([`credenciais.js`](../backend/src/credenciais.js), `admin-ia.routes.js`).
- **Venda/Agendamento:** `Venda` e `Agendamento` já têm `metodoPagamento`/`status`.
  O "Concluir atendimento" (`PATCH /agenda/:id/concluir`) já cria venda + lançamento;
  o checkout só anteciparia esse fechamento via confirmação do webhook.
- **Tool do bot:** entra como `pagamentos.gerarLink` no registry
  (`src/agente/tools/`), análoga às tools existentes; habilitável por bot via
  `toolsHabilitadas`.

**Fallback v1.** Cobrança combinada fora do app (Pix manual/maquininha) e o
operador conclui o atendimento/venda na mão. Nenhuma trava no fluxo.

---

## 2. Reembolso — *depende do PSP (item 1)*

**O que é.** Estornar um pagamento (no-show com sinal pago, cancelamento). Regra
desenhada: só usuário com permissão; no-show dá ao cliente as opções "remarcar"
ou "reembolso".

**O que falta (externo).** A **API de estorno do PSP** (item 1). Sem PSP, não há o
que estornar automaticamente.

**Onde encaixa (interno, já pronto).**
- O cancelamento interno **já existe**: `VendaController.cancelarVenda` (status
  `CANCELLED` + `canceladaPorId`, estorna estoque, cancela lançamentos). O reembolso
  financeiro é a **camada PSP** sobre esse cancelamento que já está implementado.
- Permissão: o gate por módulo × ação × escopo já cobre "quem pode estornar"
  (`VENDAS`/`excluir` ou ação dedicada futura).

**Fallback v1.** Estorno manual (operador devolve por fora) + `cancelarVenda` para
manter o caixa/estoque corretos no sistema.

---

## 3. Embedded Signup do WhatsApp (Meta) — *concierge no MVP*

**O que é.** Botão "Conectar WhatsApp": o cliente só faz login no Facebook (popup
Meta) e o número fica conectado, sem ele mexer no `developer.facebook`.

**O que falta (externo).**
- App da **Meta como Tech Provider** + **App Review** aprovado para WhatsApp.
- `App ID`/`App Secret`/`config_id` do Embedded Signup + endpoint de troca de token.

**Onde encaixa (interno, já pronto).**
- O bot já tem os campos de canal: `credencialCanalId`, `identificadorCanal`
  (phoneNumberId), `verifyTokenCanal` (`schema.prisma` / `PATCH /bots/:id/canal`).
- O tipo de credencial `WHATSAPP_CLOUD_TOKEN` já existe no cofre. O Embedded Signup
  só **automatiza o preenchimento** desses mesmos campos (hoje preenchidos à mão).
- Webhook de entrada já roda (`canais/dispatcher.js`, `webhooks-publico.routes.js`).

**Fallback v1 (em uso).** **Concierge:** você conecta o WhatsApp pelo cliente,
colando o token na tela de canal do bot. Funciona ponta a ponta hoje.

---

## 4. Disparo HSM / Campanhas em massa (Meta) — *fase 2*

**O que é.** Enviar mensagens ativas (fora da janela de 24h) em massa — recompra,
promoções — usando **templates HSM** aprovados pela Meta.

**O que falta (externo).**
- **Templates de mensagem aprovados** pela Meta (cada texto passa por revisão).
- Número com **qualidade/limite** adequado para envio ativo.

**Onde encaixa (interno, já pronto).**
- A **fila de recompra já existe** ([`campanhas.routes.js`](../backend/src/routes/campanhas.routes.js)
  `GET /recompra` + [`CampanhasPage.jsx`](../frontend/src/pages/CampanhasPage.jsx)):
  identifica os candidatos. O disparo HSM é só o **canal de saída** sobre essa fila.
- O envio reaproveita a credencial `WHATSAPP_CLOUD_TOKEN` e o caminho de envio do
  canal já usado para responder mensagens.

**Fallback v1 (em uso).** A tela de recompra lista os candidatos e o operador fala
com cada um **manualmente pelo WhatsApp** (link `wa.me`). Sem disparo automático.

---

## Resumo: o que cada item espera

| Item | Bloqueado por | Fallback v1 | Encaixe interno |
|---|---|---|---|
| Sinal/Checkout | Chave de PSP + webhook | Cobrança por fora + concluir manual | Cofre + `Venda`/`Agendamento` + tool |
| Reembolso | API de estorno do PSP | Estorno manual + `cancelarVenda` | `cancelarVenda` já pronto |
| Embedded Signup | App Review da Meta | Concierge (você conecta) | Campos de canal do bot já prontos |
| Disparo HSM | Templates aprovados Meta | Recompra manual via `wa.me` | Fila de recompra já pronta |

**Conclusão:** nenhum desses bloqueia o lançamento do core (atender → conduzir →
fechar → operar). Todos têm fallback operável hoje e ponto de encaixe definido —
viram integração mecânica quando a chave/aprovação chegar.
