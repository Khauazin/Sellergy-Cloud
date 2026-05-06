# Sellergy Cloud — Regras de negócio

> Documento vivo. Toda regra que afeta como módulos se relacionam ou como o
> AI Agent deve operar fica registrada aqui. Atualizado em 2026-05-01.

---

## 1. Catálogo × Estoque (mesmo produto, propósitos diferentes)

| Conceito | Onde | Para quê |
|---|---|---|
| **Catálogo** | `Produto` + `VariacaoProduto.precoCatalogo` | Vitrine pública/bot — como o produto é exibido ao cliente final |
| **Estoque** | `VariacaoProduto.estoqueAtual` + `preco` + `precoCusto` | Operação interna — quantidade, preço de custo, preço de venda padrão |

> Não são tabelas separadas. **Um único `Produto` + `VariacaoProduto`** atende
> os dois conceitos. Os campos são distintos:
> - `preco` — preço de venda padrão (estoque)
> - `precoCatalogo` — preço alternativo para vitrine
> - `usarPrecoCatalogo` — flag que decide qual prevalece em venda/agenda

### Regra de resolução de preço (autoritativa)

Quando alguém vai usar um produto numa venda, agendamento ou listagem
pública (catálogo), o preço resolvido segue:

```
SE  variacao.usarPrecoCatalogo === true
    E  variacao.precoCatalogo != null e > 0
THEN preco = variacao.precoCatalogo
ELSE preco = variacao.preco
```

Implementação: helper único no backend `produto.resolverPrecoVenda(variacao)`
deve ser usado em **todo** lugar que precisa do preço — vendas (manual e bot),
agenda, listagens públicas, tool `catalogo.buscarProduto` do AI Agent.

### Imagens

> 🚧 **Hoje não temos campo de imagem no Produto nem na Variação. Precisa criar.**

- `Produto.imagemUrl` — imagem ilustrativa principal do produto
- `VariacaoProduto.imagemUrl` — opcional, se a variação tem visual diferente
  (ex.: cor azul vs cor vermelha)
- Storage: **MinIO** (bucket `sellergy-midia`, prefixo `produtos/<clienteId>/...`)
- Upload: rota dedicada `POST /catalogo/produtos/:id/imagem` que valida
  tenant + tipo MIME + tamanho (max 5MB) e devolve URL assinada
- Frontend: campo de upload no formulário "Novo produto" (tanto do estoque
  quanto do catálogo) e na edição da variação

### Cadastro

- Tela **Estoque** → "Novo produto" cria `Produto` + 1 `VariacaoProduto`
  inicial com `estoqueAtual` e `preco` definidos. Pode subir imagem.
- Tela **Catálogo** → "Criar produto vinculado ao estoque" abre seletor de
  produto/variação existente (do estoque) e permite definir `precoCatalogo`,
  `usarPrecoCatalogo`, e adicionar imagem se ainda não tiver.

---

## 2. Vendas

### Lançamento (manual e bot)

- Aba **Vendas** → "Nova venda" deixa o usuário escolher Produto/Variação
  (lista vinda do catálogo + estoque). O preço sugerido vem do helper de
  resolução acima (catálogo se ativo, senão estoque).
- O usuário pode **sobrescrever** o preço (campo livre) — necessário para
  promoções e barganha presencial.
- Lead pode ser opcional. Se informado, vincula `Venda.leadId`.
- Método de pagamento opcional.

Quando bot lança via tool `vendas.lancarVenda`, mesmas regras valem. Bot
nunca deve sobrescrever o preço sem instrução explícita no prompt.

### Efeitos colaterais de criar venda

Ao registrar venda com `status = COMPLETED`:

1. **Movimenta estoque**: cria `MovimentacaoEstoque` com `tipo=VENDA`,
   `quantidade= -N`, vinculada via `vendaId`. Decrementa `variacao.estoqueAtual`.
2. **Lança financeiro**: cria `LancamentoFinanceiro` com `tipo=RECEITA`,
   `vendaId`, `valor=valor da venda`, `status=PAGO` (ou PENDENTE se método
   for boleto/pix futuro).
3. Aparece em **Relatórios**:
   - **Financeiro** (entradas)
   - **CMV** (custo da mercadoria vendida — usa `precoCusto` × quantidade)
   - **Vendas** (lista por período)

### Cancelamento

> 🚧 **Ainda não existe rota de cancelamento. Precisa criar.**

- **Local**: aba **Vendas**, linha da venda → ação "Cancelar"
- Backend: `POST /vendas/:id/cancelar` (ou `PATCH /vendas/:id` com
  `status=CANCELLED`)
- Efeitos:
  1. Atualiza `Venda.status = CANCELLED` (e timestamp de cancelamento)
  2. Estorna estoque: cria `MovimentacaoEstoque` com `tipo=DEVOLUCAO`,
     `quantidade= +N`
  3. Cancela lançamento financeiro: `LancamentoFinanceiro.status=CANCELADO`
     com `dataCancelamento` e `motivoCancelamento`
- **Não pode** ser feito da aba Financeiro — financeiro só registra despesas
  da loja (não opera vendas)

---

## 3. Financeiro

- **Lança despesas da loja** (aluguel, conta de luz, fornecedor, etc.) como
  `LancamentoFinanceiro` com `tipo=DESPESA`
- **NÃO** lança receita manualmente — receita vem de venda (cascata)
- **NÃO** cancela venda — só vê o reflexo do cancelamento
- Pode marcar lançamento como `PAGO`/`PENDENTE`/`ATRASADO`/`CANCELADO`

---

## 4. AI Agent — quais ações o bot pode tomar

O agente (Sub-fase 3.6) terá acesso a tools que **respeitam estas regras**:

| Tool | O que faz | Regra de negócio |
|---|---|---|
| `crm.criarLead` | Cria lead no funil | Só se módulo CRM liberado |
| `crm.atualizarLead` | Edita campos do lead | Só campos não destrutivos |
| `crm.moverEtapa` | Move lead entre colunas do kanban | Etapa precisa pertencer ao tenant |
| `agenda.listarHorariosLivres` | Slots disponíveis | Considera duração do serviço |
| `agenda.criarAgendamento` | Marca compromisso | Origem=AI |
| `catalogo.buscarProduto` | Pesquisa por nome/categoria | Retorna preço **resolvido** (helper) |
| `catalogo.listarProdutos` | Lista por categoria | Só visibilidade=ATIVO |
| `vendas.lancarVenda` | Registra venda | Mesmos efeitos colaterais (estoque + financeiro) |
| `mensagens.enviar` | Envia mensagem ao cliente | Cifra antes de salvar |
| `campanhas.disparar` | Aciona campanha | Só campanhas pré-aprovadas |

### Permissionamento

- Cada **bot** tem `Bot.toolsHabilitadas` (JSONB) — admin do tenant escolhe
  quais o agente pode invocar
- Tool indisponível se **módulo não liberado** ao cliente OU **não habilitada
  no bot**, mesmo que o agente "tente"
- Toda chamada de tool gera linha em `auditoria_acoes_agente` (quem-bot,
  qual tool, args, resultado, timestamp)

### Prompt do bot (`Bot.promptSistemaIa`)

- É onde o cliente do tenant escreve o tom + regras do bot
- O engine concatena com o catálogo de tools disponíveis no momento da
  chamada ao LLM
- Exemplo:

  > "Você é o atendente da Boutique Bella. Sempre cumprimente em português.
  > Nunca prometa preço sem buscar no catálogo. Se cliente pedir agenda,
  > ofereça os 3 próximos horários livres. Se for novo cliente sem cadastro,
  > use crm.criarLead para registrá-lo. Não cancele venda — encaminhe para
  > atendente humano."

---

## 5. Multi-tenant e privacidade

- **Tudo** filtra por `clienteId` (tenant)
- **Mensagens** entre cliente final e bot/vendedor são **cifradas em
  repouso** (AES-256-GCM, chave derivada por tenant via HKDF)
- **ADMIN do sistema** (Sellergy) **NÃO** descriptografa mensagens via API
  (middleware bloqueia explicitamente)
- Audit log toda decifragem em `auditoria_mensagens`

---

## 6. O que falta hoje (gaps identificados)

| # | Gap | Onde resolver |
|---|---|---|
| G1 | Campo `imagemUrl` em `Produto` | nova migration |
| G2 | Campo `imagemUrl` em `VariacaoProduto` | mesma migration |
| G3 | Rota `POST /catalogo/produtos/:id/imagem` (upload MinIO) | nova rota |
| G4 | UI de upload de imagem em Estoque e Catálogo | frontend |
| G5 | Helper `produto.resolverPrecoVenda(variacao)` | backend |
| G6 | Aplicar helper em todas as criações de venda | refator |
| G7 | Rota `POST /vendas/:id/cancelar` | nova rota |
| G8 | UI de cancelamento de venda na aba Vendas | frontend |
| G9 | Sistema de credenciais cifradas (AI/canais) | Sub-fase 3.3 |
| G10 | Nó AI_AGENT no engine | Sub-fase 3.4 |
| G11 | Catálogo de tools internas | Sub-fase 3.5 |
| G12 | AI Agent com function calling | Sub-fase 3.6 |
| G13 | Receivers WhatsApp/Telegram + Inbox | Sub-fase 3.7 |

### Pegadinha — adicionar novo TipoNo

Quando incluir um valor novo no enum `TipoNo`, atualizar **3 lugares** ou
salvar o canvas falha:

1. `backend/prisma/schema.prisma` — enum `TipoNo`
2. `frontend/src/components/Builder/catalogoNos.js` — catalogo visual
3. `backend/src/routes/builder.routes.js` — `TIPOS_NO_VALIDOS` set

(Erro tipico se faltar (3): toast vermelho "Tipo de no invalido em '...': X").

---

## 7. Plano de execução proposto

Preciso de confirmação. Sugiro a ordem abaixo:

### Bloco A — Catálogo & Vendas refinados (gaps G1-G8)
- A1. Schema: campos imagem + helper de preço — 1 sub-fase pequena
- A2. Cancelamento de venda — 1 sub-fase pequena
- A3. UI de upload de imagem + ajustes em Estoque/Catálogo/Vendas — 1 sub-fase média

### Bloco B — Inteligência (gaps G9-G13)
- B1. Sub-fase 3.3 — Credenciais cifradas
- B2. Sub-fase 3.4 — Nó AI Agent simples
- B3. Sub-fase 3.5 — Catálogo de tools (já respeitando regras de preço/estoque)
- B4. Sub-fase 3.6 — Function calling
- B5. Sub-fase 3.7 — Inbox + canais

**Pergunta:** começa por **A** (refina o que já existe) ou **B** (cria a IA)?
- Argumento pra A: tools do bot dependem do catálogo estar 100%, com imagens, e da venda saber cancelar
- Argumento pra B: você consegue ver IA funcionando antes e ajusta o catálogo conforme demanda real

Recomendação: **A primeiro** (3 sub-fases pequenas, ~1 sessão cada), depois B.
