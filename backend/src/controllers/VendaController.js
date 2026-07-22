const prisma = require('../prisma');
const { helpers: caixaHelpers } = require('./CaixaController');

// Numero maximo de retentativas em caso de colisao da unique
// constraint [clienteId, numero] — acontece quando 2 vendas do mesmo
// tenant sao criadas em paralelo. Em pratica e raro (precisa colidir
// dentro do mesmo milissegundo) mas o retry torna a operacao segura.
const MAX_RETRIES_NUMERO = 5;

// Limites sanitarios de entrada — defesa em profundidade contra valores
// absurdos/negativos (fat-finger ou abuso). Preco negativo viraria receita
// negativa; payload gigante viraria DoS/storage. OWASP: validacao de entrada.
const MAX_ITENS_VENDA = 100;
const MAX_QUANTIDADE_ITEM = 10000;
const MAX_VALOR_UNITARIO = 1000000; // R$ 1 milhao por unidade — teto de sanidade
const MAX_OBSERVACOES = 500;
const MAX_METODO_PAGAMENTO = 40;
// Teto de seguranca da listagem — evita findMany ilimitado em tenant grande.
const LIMITE_LISTAGEM_PADRAO = 1000;
const LIMITE_LISTAGEM_MAX = 2000;

class VendaController {

  async registrarVenda(req, res) {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

    // Aceita 2 formatos no body pra retrocompatibilidade:
    //   NOVO: { itens: [{ variacaoId, quantidade, valorUnitario? }], ... }
    //   LEGACY: { variacaoId, quantidade, valorTotal, ... } — 1 item
    // Se valorUnitario vier vazio, resolve pela regra do catalogo
    // (mesma logica do bot tool).
    const {
      leadId,
      itens: itensInput,
      variacaoId,           // legacy
      quantidade,           // legacy
      valorTotal,           // legacy
      metodoPagamento,
      observacoes,
      // categoriaId no body e IGNORADO — categoria agora vem do produto de
      // cada item, e backend gera 1 lancamento por categoria (relatorios
      // financeiros ficam precisos quando venda tem produtos de categorias
      // diferentes). Mantemos no destructuring pra retrocompat sem erro.
      categoriaId: _categoriaIdIgnorado,
      // 'parcelas' e METADATA, nao gera multiplos lancamentos. Quando o
      // cliente paga em 12x no cartao, a operadora paga o lojista o valor
      // cheio (~30 dias). Sistema registra 1 lancamento PAGO + nota na
      // descricao ("12x no cartao") pro relatorio mostrar.
      parcelas,
    } = req.body;

    // Normaliza itens: legacy -> [{ ... }]; novo -> usa direto.
    let itens = [];
    if (Array.isArray(itensInput) && itensInput.length > 0) {
      itens = itensInput;
    } else if (variacaoId && quantidade) {
      itens = [{ variacaoId, quantidade, valorUnitario: valorTotal && quantidade ? Number(valorTotal) / Number(quantidade) : null }];
    } else {
      return res.status(400).json({
        error: 'Informe pelo menos 1 item: { itens: [{ variacaoId, quantidade }] }',
        campos: ['itens'],
      });
    }

    if (itens.length > MAX_ITENS_VENDA) {
      return res.status(422).json({ error: `Venda com itens demais (máximo ${MAX_ITENS_VENDA}).`, campos: ['itens'] });
    }

    // Sanitiza campos de texto livre (bounds de tamanho).
    const observacoesSan = typeof observacoes === 'string' ? observacoes.slice(0, MAX_OBSERVACOES) : '';
    const metodoPagamentoSan = typeof metodoPagamento === 'string'
      ? (metodoPagamento.slice(0, MAX_METODO_PAGAMENTO).trim() || null)
      : null;

    // Valida cada item e busca variacao (em 1 query so).
    const variacaoIds = itens.map((i) => i.variacaoId).filter(Boolean);
    if (variacaoIds.length === 0) {
      return res.status(400).json({ error: 'Cada item precisa de variacaoId.' });
    }

    try {
      const variacoesDb = await prisma.variacaoProduto.findMany({
        where: { id: { in: variacaoIds }, produto: { clienteId } },
        include: { produto: true },
      });
      const mapaVariacao = new Map(variacoesDb.map((v) => [v.id, v]));

      // Valida cada item (existe + quantidade > 0 + estoque suficiente)
      const itensValidados = [];
      for (const item of itens) {
        const v = mapaVariacao.get(item.variacaoId);
        if (!v) {
          return res.status(404).json({ error: `Variacao ${item.variacaoId} nao encontrada.` });
        }
        const qtd = parseInt(item.quantidade, 10);
        if (!Number.isFinite(qtd) || qtd <= 0 || qtd > MAX_QUANTIDADE_ITEM) {
          return res.status(422).json({ error: `Quantidade invalida pra ${v.produto.nome}.` });
        }
        if (v.produto.tipo === 'FISICO' && v.estoqueAtual - qtd < 0) {
          return res.status(422).json({
            error: `Estoque insuficiente em ${v.produto.nome} (${v.nome}). Disponivel: ${v.estoqueAtual}, solicitado: ${qtd}.`,
            disponivel: v.estoqueAtual,
          });
        }
        // Preco: se vier valorUnitario explicito (sobrescrita manual), usa.
        // Caso contrario, resolve pelo helper (regra catalogo > estoque).
        const { resolverPrecoVenda } = require('../produto');
        const precoUnit = (item.valorUnitario != null && !Number.isNaN(parseFloat(item.valorUnitario)))
          ? parseFloat(item.valorUnitario)
          : resolverPrecoVenda(v);
        // Preço não pode ser negativo (viraria receita negativa) nem absurdo.
        if (!Number.isFinite(precoUnit) || precoUnit < 0 || precoUnit > MAX_VALOR_UNITARIO) {
          return res.status(422).json({ error: `Preço inválido pra ${v.produto.nome} — não pode ser negativo.`, campos: ['valorUnitario'] });
        }
        itensValidados.push({ variacao: v, quantidade: qtd, precoUnitario: precoUnit, subtotal: precoUnit * qtd });
      }

      const valorTotalCalculado = itensValidados.reduce((acc, i) => acc + i.subtotal, 0);

      // Venda manual EXIGE caixa aberto. Sem caixa, retorna 409 com codigo
      // pra frontend mostrar dialogo amigavel "Abra o caixa antes".
      const sessaoAberta = await caixaHelpers.buscarSessaoAberta(clienteId);
      if (!sessaoAberta) {
        return res.status(409).json({
          error: 'Abra o caixa antes de registrar a venda. Ele controla o saldo do dia e fica disponível em Financeiro · Caixa.',
          codigo: 'CAIXA_FECHADO',
        });
      }

      // Retry loop pro numero sequencial (mesma logica de antes).
      let resultado;
      let tentativa = 0;
      while (true) {
        try {
          const ultimaDoTenant = await prisma.venda.findFirst({
            where: { clienteId },
            orderBy: { numero: 'desc' },
            select: { numero: true },
          });
          const proximoNumero = (ultimaDoTenant?.numero || 0) + 1;

          resultado = await prisma.$transaction(async (tx) => {
            // Descricao resumida: nome do 1o item + "(+N itens)" se houver mais.
            // Anota parcelas quando >1 (metadata pra relatorio).
            const descPrincipal = itensValidados[0].variacao.produto.nome;
            const parcelasNum = parseInt(parcelas, 10);
            const sufixoParcelas = Number.isFinite(parcelasNum) && parcelasNum > 1
              ? ` · ${parcelasNum}x ${metodoPagamentoSan === 'CREDITO' ? 'no cartão' : ''}`.trimEnd()
              : '';
            const descricaoVenda = observacoesSan
              ? `${observacoesSan}${sufixoParcelas}`
              : itensValidados.length === 1
                ? `${descPrincipal} (${itensValidados[0].variacao.nome}) x${itensValidados[0].quantidade}${sufixoParcelas}`
                : `${descPrincipal} +${itensValidados.length - 1} item(s)${sufixoParcelas}`;

            // 1. Venda — vinculada a sessao de caixa aberta
            const venda = await tx.venda.create({
              data: {
                clienteId,
                numero: proximoNumero,
                leadId: leadId || null,
                sessaoCaixaId: sessaoAberta.id,
                valor: valorTotalCalculado,
                metodoPagamento: metodoPagamentoSan,
                descricao: descricaoVenda,
                status: 'COMPLETED',
              },
            });

            // 2. Pra cada item: movimentacao + decrementa estoque (servico nao)
            for (const it of itensValidados) {
              await tx.movimentacaoEstoque.create({
                data: {
                  variacaoId: it.variacao.id,
                  tipo: 'VENDA',
                  quantidade: -Math.abs(it.quantidade),
                  // Congela o custo do momento da venda (custo medio corrente)
                  // pra o CMV e o lucro ficarem imutaveis nos relatorios.
                  custoUnitario: it.variacao.precoCusto ?? null,
                  motivo: `Venda #${venda.numero}`,
                  vendaId: venda.id,
                },
              });
              if (it.variacao.produto.tipo === 'FISICO') {
                await tx.variacaoProduto.update({
                  where: { id: it.variacao.id },
                  data: { estoqueAtual: { increment: -Math.abs(it.quantidade) } },
                });
              }
            }

            // 3. 1 LancamentoFinanceiro pra venda inteira (mais simples pra
            // financeiro — relatorios agrupam por venda). Descricao detalhada
            // com os itens vendidos.
            // Agrupa itens por categoria do produto. Cada grupo vira 1
            // LancamentoFinanceiro vinculado a mesma venda — assim relatorios
            // por categoria ficam precisos quando venda tem produtos de
            // categorias diferentes. Sem categoria (produto nao classificado)
            // vira 1 grupo separado com categoriaId=null.
            const gruposPorCat = new Map();
            for (const it of itensValidados) {
              const catId = it.variacao.produto.categoriaId || null;
              if (!gruposPorCat.has(catId)) gruposPorCat.set(catId, []);
              gruposPorCat.get(catId).push(it);
            }

            const lancamentosCriados = [];
            for (const [catId, itensDoGrupo] of gruposPorCat.entries()) {
              const subtotalGrupo = itensDoGrupo.reduce((acc, i) => acc + i.subtotal, 0);
              const detalheItens = itensDoGrupo
                .map((it) => `${it.variacao.produto.nome} (${it.variacao.nome}) x${it.quantidade}`)
                .join(', ');
              const lanc = await tx.lancamentoFinanceiro.create({
                data: {
                  clienteId,
                  leadId: leadId || null,
                  vendaId: venda.id,
                  sessaoCaixaId: sessaoAberta.id,
                  categoriaId: catId,
                  descricao: `Receita Venda #${venda.numero}: ${detalheItens}${sufixoParcelas}`,
                  valor: subtotalGrupo,
                  tipo: 'RECEITA',
                  status: 'PAGO',
                  dataVencimento: new Date(),
                  dataPagamento: new Date(),
                },
              });
              lancamentosCriados.push(lanc);
            }

            return {
              venda,
              totalItens: itensValidados.length,
              valorTotal: valorTotalCalculado,
              lancamentos: lancamentosCriados,
              totalLancamentos: lancamentosCriados.length,
            };
          });
          break;
        } catch (err) {
          if (err?.code === 'P2002' && tentativa < MAX_RETRIES_NUMERO) {
            tentativa += 1;
            continue;
          }
          throw err;
        }
      }

      return res.status(201).json({ success: true, data: resultado });

    } catch (error) {
      console.error('[VendaController]', error);
      return res.status(500).json({ error: 'Erro ao processar a venda.' });
    }
  }

  /**
   * Cancela uma venda. Estorna estoque e cancela lançamentos financeiros
   * vinculados em uma única transação. Idempotente: se a venda já estava
   * cancelada, retorna 200 sem efeito colateral.
   *
   * Body opcional: { motivo: string }.
   */
  async cancelarVenda(req, res) {
    const { clienteId, id: usuarioId } = req.usuario;
    if (!clienteId) {
      return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
    }

    const { id } = req.params;
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

    // Motivo obrigatorio — preserva auditoria. Sem ele, qualquer um cancela
    // venda sem rastro. Minimo 5 caracteres pra evitar "ok", "xxx" etc.
    if (motivo.length < 5) {
      return res.status(422).json({
        error: 'Informe o motivo do cancelamento (mínimo 5 caracteres). Sem motivo, não tem como auditar depois.',
        campos: ['motivo'],
      });
    }

    try {
      const venda = await prisma.venda.findFirst({
        where: { id, clienteId },
        include: {
          movimentacoesEstoque: true,
          lancamentosFinanceiros: true,
        },
      });
      if (!venda) return res.status(404).json({ error: 'Venda não encontrada.' });
      if (venda.status === 'CANCELLED') {
        return res.status(200).json({ ok: true, ja_cancelada: true, venda });
      }

      const agora = new Date();

      const resultado = await prisma.$transaction(async (tx) => {
        // Re-busca venda + relacionadas DENTRO da transacao. Garante consistencia
        // se algo foi alterado entre o fetch inicial e o cancelamento (ex:
        // lancamento editado, segunda tentativa de cancelar em race).
        const vendaFresca = await tx.venda.findFirst({
          where: { id, clienteId },
          include: {
            movimentacoesEstoque: true,
            lancamentosFinanceiros: true,
          },
        });
        if (!vendaFresca) throw Object.assign(new Error('Venda nao encontrada.'), { status: 404 });
        if (vendaFresca.status === 'CANCELLED') {
          // Race: outra requisicao cancelou antes. Retorna a versao atual.
          return vendaFresca;
        }

        // 1. Marca venda como cancelada (motivo ja validado obrigatorio).
        const atualizada = await tx.venda.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            dataCancelamento: agora,
            motivoCancelamento: motivo,
            canceladaPorId: usuarioId || null,
          },
        });

        // 2. Estorna estoque para CADA movimentação tipo VENDA dessa venda.
        // Cria DEVOLUCAO compensatoria e atualiza saldo. Idempotente: se ja
        // existir DEVOLUCAO pra esse mesmo (vendaId, variacaoId), pula —
        // evita estorno duplo em retry.
        const devolucoesExistentes = new Set(
          (vendaFresca.movimentacoesEstoque || [])
            .filter((m) => m.tipo === 'DEVOLUCAO')
            .map((m) => m.variacaoId)
        );
        for (const m of vendaFresca.movimentacoesEstoque || []) {
          if (m.tipo !== 'VENDA') continue;
          if (devolucoesExistentes.has(m.variacaoId)) {
            console.warn(`[cancelarVenda] DEVOLUCAO ja existe pra venda ${vendaFresca.numero} variacao ${m.variacaoId} — pulando estorno.`);
            continue;
          }
          const qtdEstorno = Math.abs(m.quantidade);
          await tx.movimentacaoEstoque.create({
            data: {
              variacaoId: m.variacaoId,
              tipo: 'DEVOLUCAO',
              quantidade: qtdEstorno,
              motivo: `Cancelamento da venda #${vendaFresca.numero} — ${motivo}`,
              vendaId: vendaFresca.id,
            },
          });
          await tx.variacaoProduto.update({
            where: { id: m.variacaoId },
            data: { estoqueAtual: { increment: qtdEstorno } },
          });
        }

        // 3. Cancela lançamentos financeiros vinculados (que ainda não estão
        // cancelados). Marca data e motivo. Loga se valor foi alterado pos-venda
        // (auditoria — divergencia entre venda e financeiro).
        for (const l of vendaFresca.lancamentosFinanceiros || []) {
          if (l.status === 'CANCELADO') continue;
          if (l.status !== 'PAGO') {
            console.warn(`[cancelarVenda] Lancamento ${l.id} venda ${vendaFresca.numero} estava em status ${l.status} (esperado PAGO) — cancelando mesmo assim.`);
          }
          await tx.lancamentoFinanceiro.update({
            where: { id: l.id },
            data: {
              status: 'CANCELADO',
              dataCancelamento: agora,
              motivoCancelamento: `Cancelamento da venda #${vendaFresca.numero} — ${motivo}`,
            },
          });
        }

        return atualizada;
      });

      return res.json({ ok: true, venda: resultado });
    } catch (error) {
      console.error('[VendaController/cancelar]', error);
      return res.status(500).json({ error: 'Erro ao cancelar venda.' });
    }
  }

  /**
   * Vincula (ou desvincula) um lead a uma venda ja registrada. Util pra
   * quando a venda foi feita sem cliente identificado e dps o vendedor
   * descobre quem era — preserva auditoria no CRM.
   *
   * Body: { leadId: string | null }.
   * Propaga o leadId tambem pros LancamentoFinanceiro vinculados pra
   * manter consistencia (relatorios por cliente ficam corretos).
   */
  async vincularLead(req, res) {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

    const { id } = req.params;
    const { leadId } = req.body || {};

    try {
      const venda = await prisma.venda.findFirst({ where: { id, clienteId } });
      if (!venda) return res.status(404).json({ error: 'Venda nao encontrada.' });

      // leadId pode ser null (desvinculo) ou string (vinculo novo).
      let leadValido = null;
      if (leadId) {
        leadValido = await prisma.lead.findFirst({
          where: { id: leadId, clienteId },
          select: { id: true, nome: true },
        });
        if (!leadValido) return res.status(404).json({ error: 'Lead nao encontrado ou nao pertence ao tenant.' });
      }

      const atualizada = await prisma.$transaction(async (tx) => {
        const v = await tx.venda.update({
          where: { id },
          data: { leadId: leadValido?.id || null },
          include: { lead: true },
        });
        // Propaga pros lancamentos pra consistencia em relatorios por cliente.
        await tx.lancamentoFinanceiro.updateMany({
          where: { vendaId: id, clienteId },
          data: { leadId: leadValido?.id || null },
        });
        return v;
      });

      return res.json({ ok: true, venda: atualizada });
    } catch (error) {
      console.error('[VendaController/vincularLead]', error);
      return res.status(500).json({ error: 'Erro ao vincular cliente.' });
    }
  }

  /**
   * Lista as vendas do cliente.
   */
  async listarVendas(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      // Teto de segurança: nunca carrega ilimitado. ?limite= permite paginar depois.
      const limiteBruto = parseInt(req.query.limite, 10);
      const take = Number.isFinite(limiteBruto) && limiteBruto > 0
        ? Math.min(limiteBruto, LIMITE_LISTAGEM_MAX)
        : LIMITE_LISTAGEM_PADRAO;
      const vendas = await prisma.venda.findMany({
        where: { clienteId },
        include: {
          lead: true,
          movimentacoesEstoque: {
            include: {
              variacao: {
                include: { produto: true }
              }
            }
          },
          lancamentosFinanceiros: true
        },
        orderBy: { criadoEm: 'desc' },
        take,
      });
      res.json(vendas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar vendas.' });
    }
  }
}

module.exports = new VendaController();
