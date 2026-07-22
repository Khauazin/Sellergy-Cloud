# Estoque, custo e nota fiscal — design de produção

> Detalha o controle de **custo/lucro de produto**, a **entrada de nota de compra**
> e a **emissão de nota fiscal**, com as proteções de produção (segurança, integridade,
> idempotência). Costura com `erp-arquitetura-e-operacao.md` (§5 Fiscal) e `erp-pivo.md`.
> Criado em 2026-06-23. **Codar só após aprovação.**

---

## 1. Preço do produto = custo + lucro (não preço cheio)

O lojista deixa de digitar "preço de venda". Digita **custo** (preço de compra) e **lucro**,
e o sistema **soma** pra formar o preço. Dois modos:

| Modo | Entrada | Preço de venda | O que fica fixo |
|---|---|---|---|
| **Valor (R$)** | custo R$30 · lucro R$25 | **R$55** | o lucro em R$ |
| **Percentual (%)** | custo R$30 · lucro 25% | **R$37,50** (custo +25%) | o percentual |

**Regra central:** o **custo muda** (vem da nota), o **lucro é fixo**, preço = custo + lucro.
- Chega lote a R$36,67/un → custo vira R$36,67, lucro continua R$25 → preço passa a **R$61,67** sozinho.
- No modo %, o percentual é que persiste (o lucro em R$ acompanha o custo).

**Campos novos em `VariacaoProduto`:**
- `precoCusto` *(já existe)* — custo atual (atualizado pela entrada de nota).
- `lucroTipo` — enum `LucroTipo { VALOR, PERCENTUAL }`.
- `lucroValor` — Float (o R$ ou o %).
- `preco` *(já existe)* — **derivado**, recalculado = custo + lucro. Venda/agenda/bot
  seguem lendo `preco` normalmente.

> **Custo ao receber lote:** padrão = **custo médio ponderado**
> `novoCusto = (estoqueValor + valorEntrada) / (estoqueQtd + qtdEntrada)` — evita
> supervalorizar estoque antigo quando o preço do lote muda. Configurável por tenant:
> `médio` (recomendado) ou `última nota` (mais simples). O lucro fixo e os relatórios
> funcionam igual nos dois.

---

## 2. Custo das vendas (CMV) e "não perder os dados"

Hoje nem `MovimentacaoEstoque` nem `Venda` guardam custo — o lucro "anda" quando o
custo muda. Correção: **congelar o custo no momento da saída**.

- `MovimentacaoEstoque.custoUnitario` *(novo)* — custo daquele movimento. Na entrada,
  o custo da nota; na **venda**, o custo médio consumido (snapshot imutável).
- A partir do snapshot, por venda: **custo**, **lucro** (preço − custo) e **total** (preço).
  O lucro histórico não muda mais, mesmo que o custo do produto mude depois.

Agregados dos relatórios (caixa, financeiro, vendas):
- Receita = Σ preço · Custo das vendas (CMV) = Σ custoUnitario · **Lucro bruto** = Receita − CMV.

> **Sutileza contábil (coberta):** a compra entra como **despesa** (§3) e a venda mostra o
> **custo na margem** — o mesmo custo aparece nas duas visões. Os relatórios tratam isso como
> **duas visões separadas e rotuladas**: (1) **fluxo de caixa** (entrou venda, saiu compra) e
> (2) **margem** (preço − custo). Nunca somar as duas cruamente (dobraria o custo). A UI deixa
> explícito qual visão está sendo mostrada.

---

## 3. Entrada de nota de compra (e a despesa)

Fluxo: **categoria → produto → fornecedor**; ao **movimentar compra**, seleciona o produto,
informa/importa a nota, o sistema lê e atualiza tudo.

**Modelos novos:**
- `Fornecedor` — `clienteId, nome, cnpj?, email?, telefone?, ativo`.
- `NotaCompra` (cabeçalho da entrada) — `clienteId, fornecedorId?, numero?, chaveAcesso?,
  valorTotal, emitidaEm?, origem (MANUAL|XML), xmlRef?, criadoEm`. Os itens são
  `MovimentacaoEstoque` tipo `COMPRA_FORNECEDOR` *(tipo já existe)* com `custoUnitario` e
  `notaCompraId`.

**Efeitos da entrada (transação única):**
1. Cria a `NotaCompra` + as movimentações de entrada (com custo unitário).
2. Recalcula o `precoCusto` (médio) de cada item → `preco` recalcula com o lucro fixo.
3. Lança a despesa: `LancamentoFinanceiro` DESPESA na categoria **`Compra de mercadorias`**
   *(termo contábil padrão — também aceito "Mercadorias para revenda" / "Fornecedores")*,
   opcionalmente vinculada a uma **Conta a pagar** *(já existe)* pra rastrear o pagamento.

**Importar NF-e (XML):** o XML do fornecedor preenche itens, quantidades, custos unitários e
o CNPJ do fornecedor → o usuário confere → confirma. *(CSV é fallback pra carga em massa de
catálogo, não substitui o XML da nota.)*

**Sem nota fiscal (permitido):** a entrada pode ser **manual, sem nota** (compra informal,
ajuste de estoque). A `NotaCompra` registra `origem = SEM_NOTA` (ou a movimentação entra sem
`notaCompraId`), e o **relatório de estoque/compras destaca** as entradas/produtos sem nota
fiscal de origem — transparência fiscal, o lojista vê o que entrou sem nota.

---

## 4. Emissão de nota fiscal (saída)

Emissão via provedor terceiro (Focus NFe / Nuvem Fiscal) — assíncrona, por estados, com retry.

**Vínculo nota ↔ produto/serviço (valor travado):**
- `DocumentoFiscalItem` *(novo)* — `documentoId, produtoId?/variacaoId?, descricao,
  quantidade, valorUnitario, valorTotal, ncm?, cfop?, cest?`.
- Ao montar a nota, o usuário **pesquisa o produto/serviço** e insere → `valorUnitario` vem
  **do catálogo, travado/somente-leitura** (integridade: a nota não diverge do preço cadastrado).
  Os campos **variáveis por estado/regra** (NCM, CFOP, CST/CSOSN, dados do destinatário) ficam
  **editáveis** — o usuário preenche.
- A nota pode nascer de uma `Venda` (`DocumentoFiscal.vendaId` já existe) puxando os itens dela,
  ou avulsa.

**Imprimir / exportar:** `DocumentoFiscal` já guarda `urlPdf` (DANFE) e `urlXml` do provedor →
botões **Baixar PDF**, **Baixar XML** e **Exportar CSV** (dados da nota pra planilha).

**Estados + fila:** `StatusDocumentoFiscal { PENDENTE, PROCESSANDO, EMITIDA, ERRO, CANCELADA }`
*(já existe)*; emissão num job com **retry** e mensagem de erro legível (`mensagemErro`).

---

## 5. Dados da empresa (emitente) — buraco a preencher

Hoje só há `cnpj` e `inscricao` em `ConfiguracaoFiscal`. Emissão exige a identidade completa.

**Campos novos** (em `ConfiguracaoFiscal` ou modelo `DadosEmpresa`):
`razaoSocial, nomeFantasia, cnpj, inscricaoEstadual, inscricaoMunicipal, regimeTributario,
cnae?, email, telefone` + **endereço**: `logradouro, numero, complemento?, bairro, municipio,
uf, cep`. Alimenta a nota, o recibo e o cabeçalho dos documentos.

**Certificado digital:** vai pro **provedor** (não fica conosco) — guardamos só `certificadoRef`
*(já existe)*; o provedor valida CNPJ/validade. Ganho de segurança/LGPD: nunca seguramos o `.pfx`.

---

## 6. Segurança e produção (proteção contra bug/erro)

| Risco | Proteção |
|---|---|
| **Upload malicioso (XML/CSV)** | Whitelist de extensão **e** MIME; **tamanho máximo** (rejeita arquivo grande = anti-DoS); para XML, **parser com entidades externas e DTD DESABILITADOS** (anti-XXE — OWASP); sem acesso a rede/arquivo no parse. |
| **Arquivo malformado** | Validação de **estrutura** (é uma NF-e/CSV no formato esperado?). Não bateu → **recusa com erro claro**, nada é gravado. |
| **Nota/entrada duplicada** | **Idempotência** pela `chaveAcesso` (NF-e) — a mesma nota não entra 2×. Webhooks PSP já idempotentes. |
| **Preço divergente na nota** | `valorUnitario` do item **travado** a partir do catálogo (§4). |
| **Entrada parcial/corrompida** | Toda entrada de nota e emissão rodam em **transação** (tudo ou nada). |
| **Dado sensível (certificado, credenciais)** | No cofre cifrado / no provedor; **menor privilégio** (módulo FISCAL + papel privilegiado, já temos); multi-tenant por `clienteId` em toda query (sem IDOR). |
| **Erro do provedor** | Estados + retry na fila; nunca trava a venda; `mensagemErro` legível. |

Validação de entrada (tipos, faixas, obrigatórios) em **todas** as rotas novas; respostas de
erro na voz do sistema (o que falhou e como resolver).

---

## 7. Resumo do modelo de dados (novo/alterado)

- `VariacaoProduto` + `lucroTipo`, `lucroValor` (preço derivado).
- `MovimentacaoEstoque` + `custoUnitario`, `notaCompraId?`.
- `Fornecedor` *(novo)*.
- `NotaCompra` *(novo)* — cabeçalho da entrada de compra.
- `DocumentoFiscalItem` *(novo)* — itens da nota emitida (valor travado).
- `ConfiguracaoFiscal`/`DadosEmpresa` — identidade + endereço do emitente.
- enum `LucroTipo { VALOR, PERCENTUAL }`.
- `CategoriaFinanceira` semente: **"Compra de mercadorias"** (DESPESA).

🗄️ **Migração** `estoque_custo_fiscal` (rodar no host).

---

## 8. Decisões e sequência

| Decisão | Proposta |
|---|---|
| Custo ao receber lote | **Custo médio ponderado** (config: médio | última nota) |
| Nome da despesa de compra | **"Compra de mercadorias"** |
| Modos de lucro | **Valor (R$) e Percentual (%)**, os dois |

**Ordem de build sugerida:**
1. **Fundação de custo** — campos custo+lucro, `custoUnitario`, snapshot na venda + recalculo do preço.
2. **Entrada de nota** — `Fornecedor`/`NotaCompra`, efeito no estoque + despesa "Compra de mercadorias".
3. **Import NF-e (XML)** + validação de upload (anti-XXE).
4. **Dados do emitente** + emissão com `DocumentoFiscalItem` (valor travado) + imprimir/exportar.
5. **Relatórios** — custo/lucro/total e as duas visões (caixa × margem).

## Pendências
- [x] Aprovar este doc.
- [x] 3 decisões fechadas (§8): custo médio · "Compra de mercadorias" · lucro em R$ e %.
- [x] **Fundação de custo feita** (schema + backend `CatalogoController`/`VendaController` + backfill).
- [x] **Relatórios usam o custo congelado** (snapshot `custoUnitario` com fallback): `CmvController`
  (custos + lucratividade) e `RelatoriosController` (CMV do período, CMV por venda, por categoria).
  *Pendência menor:* a receita por produto/categoria ainda usa o preço atual (não há snapshot de
  preço de venda no movimento); a receita total já vem do `Venda.valor` real.
- [x] **Fornecedores (cadastro + import CSV) feito** — model `Fornecedor`, CRUD multi-tenant
  (`FornecedorController`/`fornecedores.routes`, gating do módulo `ESTOQUE`), importação CSV com
  validação de conteúdo (`utils/csvSeguro` anti-binário/anti-DoS/anti-injeção-de-fórmula + validação
  por linha + dedupe por CNPJ), `FornecedoresPage` (lista/busca/drawer + modelo CSV).
- [x] **Entrada de nota de compra (manual) feita** — model `NotaCompra` + enum `OrigemNotaCompra`,
  `MovimentacaoEstoque.notaCompraId`. `NotaCompraController.criar` numa transação: cria a nota, pra
  cada item gera movimentação `COMPRA_FORNECEDOR` (+estoque, `custoUnitario` congelado),
  recalcula o **custo médio ponderado** e o **preço** (`produto.calcularPreco`, fonte única — também
  consumida pelo `CatalogoController`), e lança a despesa **"Compra de mercadorias"** (categoria criada
  sob demanda; paga ou conta a pagar pelo flag `pago`). Front: `EntradaNotaPage` (lista + drawer com
  fornecedor/número/data/itens). 🗄️ **Migração** `notas_compra` (rodar no host — cobre também
  `fornecedores` se ainda não foi aplicada).
- [x] **Import NF-e (XML) com anti-XXE feito** — `utils/nfeSeguro.parseNfe`: NÃO usa parser de XML
  (extração de texto delimitada, sem expandir entidade); recusa DTD/`<!ENTITY>`/PI estranha/binário,
  limita itens. Endpoint `POST /notas-compra/importar-xml` (só preview, casa fornecedor por CNPJ);
  o front (`EntradaNotaPage`) preenche e o usuário mapeia cada item a um produto e confirma via `criar`.
  Bateria `utils/seguranca-uploads.test.js` (16 casos: XXE file/SSRF, billion laughs, DTD externo, PI
  maliciosa, binário, NF-e falsa, malformada, nota gigante, CSV injection/binário) — **passou** (`npm test`).
  Auto-casamento: ao importar, cada item da NF-e já é ligado ao produto certo do estoque (código→SKU ou
  nome) quando o match é único; ambíguo fica manual.
- [x] **Passo 4 — emitente + emissão por itens feito** — `ConfiguracaoFiscal` ganhou os dados do emitente
  (razão social, nome fantasia, IE/IM, CNAE, e-mail, telefone, endereço); `DocumentoFiscalItem` (novo) com
  `valorUnitario` **travado do catálogo**; `DocumentoFiscal` ganhou `baseValor` + `valorTotal`. Emissão por
  **produtos** com toggle **venda/custo** (`POST /fiscal/documentos` aceita `itens`+`baseValor`; o unitário
  sai de `preco` ou `precoCusto`). Front (`FiscalPage`): seção do emitente na config + drawer por produtos +
  **exportar CSV** (anti-injeção) e baixar PDF. Tudo ainda `fixture` (sem SEFAZ — isso é go-live/Fase 4 real).
- [x] **NCM/CFOP/CEST + destinatário + segurança de go-live feito** — `DocumentoFiscalItem` ganha
  NCM/CFOP/CEST (validados: 8/4/7 dígitos); `DocumentoFiscal` ganha destinatário (nome/documento/email/
  UF/município, CNPJ-CPF com dígito verificador). **Segurança do go-live** (`utils/validacaoFiscal.js`):
  (1) `resolverModoFiscal` — 'live' só com `FISCAL_LIVE=true` **e** ambiente PRODUÇÃO, senão sempre
  `fixture` (nunca emite real por acidente); (2) **gate de produção** — bloqueia a emissão se faltar
  emitente/certificado/credencial/NCM-CFOP/destinatário; (3) certificado **nunca** é armazenado aqui
  (`conteudoCertificadoProibido` recusa .pfx/senha no body — fica no provedor). Testes
  `utils/validacaoFiscal.test.js` (7 casos) — **passou** (`npm test`, 23 no total). Front: NCM/CFOP/CEST
  por item (toggle) + seção destinatário no drawer de emissão.
  **Falta só o go-live real:** conta no provedor + certificado no provedor + homologação SEFAZ + ligar
  `FISCAL_LIVE` (decisão operacional do cliente). Pendências de lançamento: Termos de uso/LGPD.

## Anotações pré-lançamento (retomar)

- **Serviço ≠ produto:** serviço é **só preço de venda** (sem custo+lucro, sem estoque, sem
  nota de compra). Só toca o fiscal se o cliente quiser **emitir NFS-e** do serviço prestado.
- **Fiscal é regional (cuidado):** NF-e/NFC-e seguem regra **estadual** (ICMS); NFS-e segue
  regra **municipal** (ISS). Cada estado e cada município tem layout/exigência própria — o
  Brasil tem muitas regularizações. Por isso a emissão é via **provedor** (Focus NFe / Nuvem
  Fiscal), que absorve essa complexidade; o nosso lado guarda emitente + itens e delega.
- **Termos de uso + exclusão (LGPD):** o cliente precisa **aceitar obrigatoriamente** os Termos
  de Uso e a Política de Exclusão/retenção de dados — gate no cadastro/1º acesso, com registro
  do aceite (data + versão). **Pré-requisito de lançamento.**
- **Rótulo do menu por segmento:** loja = "Produtos" · clínica = "Serviços" · híbrido = "Catálogo".
- **Próximo passo do estoque (passo 2 do §8):** entrada de nota (`Fornecedor` + `NotaCompra` +
  despesa "Compra de mercadorias") + form do Catálogo (custo+lucro só pra produto; serviço = preço).
