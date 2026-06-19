// Tool de venda. Espelha a logica do VendaController (cria Venda +
// MovimentacaoEstoque + LancamentoFinanceiro em transacao). O preco e
// sempre resolvido pelo helper produto.resolverPrecoVenda — o agente NAO
// pode arbitrar preco diferente sem instrucao explicita do prompt.

const prisma = require('../../prisma');
const { resolverPrecoVenda } = require('../../produto');
const { lockClienteAdvisory } = require('../../utils/locks');

// Mesmo limite usado no VendaController. Cobre colisao de 2+ vendas em paralelo
// (raro, mas possivel quando bot e vendedor manual lancam no mesmo ms).
const MAX_RETRIES_NUMERO = 5;

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

const lancarVenda = {
  nome: 'vendas.lancarVenda',
  modulo: 'VENDAS',
  descricao:
    'Registra uma venda com 1 ou mais itens. Decrementa o estoque de cada item (so fisico) e cria 1 lancamento financeiro consolidado como receita PAGA. ' +
    'O preco unitario de cada item e calculado pela regra do helper (catalogo prevalece quando a flag esta ligada). ' +
    'Aceita formato novo (itens=[...]) ou legado (variacaoId + quantidade) pra retrocompatibilidade.',
  parametros: {
    tipo: 'object',
    propriedades: {
      itens: {
        tipo: 'array',
        descricao: 'Lista de itens da venda: [{ variacaoId, quantidade }]. Use este formato pra vendas com mais de 1 produto.',
        opcional: true,
      },
      variacaoId: { tipo: 'string', descricao: 'ID da variacao (formato legado, 1 item)', opcional: true },
      quantidade: { tipo: 'number', descricao: 'Quantidade (formato legado, 1 item, >= 1)', opcional: true },
      leadId: { tipo: 'string', descricao: 'Lead vinculado (opcional)', opcional: true },
      metodoPagamento: { tipo: 'string', descricao: 'PIX, DINHEIRO, CARTAO, etc.', opcional: true },
      observacoes: { tipo: 'string', opcional: true },
      // categoriaFinanceiraId aceito mas IGNORADO — categoria vem do produto
      // de cada item (1 lancamento por categoria automaticamente).
    },
    obrigatorios: [],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);

    // Normaliza payload: novo formato (itens[]) ou legado (variacaoId+quantidade).
    let itens = [];
    if (Array.isArray(args.itens) && args.itens.length > 0) {
      itens = args.itens;
    } else if (args.variacaoId && args.quantidade) {
      itens = [{ variacaoId: args.variacaoId, quantidade: args.quantidade }];
    } else {
      throw new Error('Informe pelo menos 1 item: { itens: [{ variacaoId, quantidade }] } ou variacaoId+quantidade.');
    }

    // Busca todas as variacoes de uma vez.
    const variacaoIds = itens.map((i) => i.variacaoId).filter(Boolean);
    if (variacaoIds.length === 0) throw new Error('Cada item precisa de variacaoId.');

    const variacoesDb = await prisma.variacaoProduto.findMany({
      where: { id: { in: variacaoIds }, produto: { clienteId: contexto.clienteId } },
      include: { produto: true },
    });
    const mapaVariacao = new Map(variacoesDb.map((v) => [v.id, v]));

    // Valida e prepara cada item.
    const itensValidados = [];
    for (const item of itens) {
      const variacao = mapaVariacao.get(item.variacaoId);
      if (!variacao) throw new Error(`Variacao ${item.variacaoId} nao encontrada (ou nao pertence ao tenant).`);
      const qtd = parseInt(item.quantidade, 10);
      if (!Number.isFinite(qtd) || qtd < 1) throw new Error(`Quantidade invalida pra ${variacao.produto.nome}.`);
      if (variacao.produto.tipo === 'FISICO' && variacao.estoqueAtual - qtd < 0) {
        throw new Error(`Estoque insuficiente em ${variacao.produto.nome}. Disponivel: ${variacao.estoqueAtual}, solicitado: ${qtd}.`);
      }
      const precoUnitario = resolverPrecoVenda(variacao);
      itensValidados.push({ variacao, quantidade: qtd, precoUnitario, subtotal: precoUnitario * qtd });
    }
    const valorTotal = itensValidados.reduce((acc, i) => acc + i.subtotal, 0);

    // Retry loop pelo numero sequencial — mesma estrategia do VendaController
    // pra cobrir colisao da unique [clienteId, numero] quando 2+ vendas (bot +
    // manual) chegam no mesmo ms.
    let resultado;
    let tentativa = 0;
    while (true) {
      try {
        const ultimaDoTenant = await prisma.venda.findFirst({
          where: { clienteId: contexto.clienteId },
          orderBy: { numero: 'desc' },
          select: { numero: true },
        });
        const proximoNumero = (ultimaDoTenant?.numero || 0) + 1;

        resultado = await prisma.$transaction(async (tx) => {
          // Lock advisory pelo clienteId — serializa esta venda com:
          //   - cron 00:01 fechando AUTO_BOT (evita 2 sessoes ABERTA simultaneas)
          //   - outras vendas concorrentes do mesmo tenant
          // Liberado automaticamente no fim da transacao.
          await lockClienteAdvisory(tx, contexto.clienteId);

          // Bot precisa de caixa aberto pra vincular. Se nao tem, cria AUTO_BOT
          // com fundo 0 — funcionamento 24h, sem intervencao manual. Cron 00:00
          // cuida do fechamento diario.
          let sessao = await tx.sessaoCaixa.findFirst({
            where: { clienteId: contexto.clienteId, status: 'ABERTA' },
            orderBy: { abertaEm: 'desc' },
          });
          if (!sessao) {
            sessao = await tx.sessaoCaixa.create({
              data: {
                clienteId: contexto.clienteId,
                fundoCaixa: 0,
                status: 'ABERTA',
                origem: 'AUTO_BOT',
                observacaoAbertura: 'Aberta automaticamente pelo bot (venda chegou sem caixa manual aberto).',
              },
            });
          }

          const descPrincipal = itensValidados[0].variacao.produto.nome;
          const descricaoVenda = args.observacoes
            ? String(args.observacoes).trim()
            : itensValidados.length === 1
              ? `${descPrincipal} (${itensValidados[0].variacao.nome}) x${itensValidados[0].quantidade}`
              : `${descPrincipal} +${itensValidados.length - 1} item(s)`;

          const venda = await tx.venda.create({
            data: {
              clienteId: contexto.clienteId,
              numero: proximoNumero,
              leadId: args.leadId || null,
              sessaoCaixaId: sessao.id,
              valor: valorTotal,
              metodoPagamento: args.metodoPagamento ? String(args.metodoPagamento).trim() : null,
              descricao: descricaoVenda,
              status: 'COMPLETED',
            },
          });

          for (const it of itensValidados) {
            await tx.movimentacaoEstoque.create({
              data: {
                variacaoId: it.variacao.id,
                tipo: 'VENDA',
                quantidade: -Math.abs(it.quantidade),
                motivo: `Venda #${venda.numero} (agente)`,
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

          // Agrupa por categoria do produto: 1 lancamento por categoria.
          // Categoria vem de produto.categoriaId (nao do body — bot nao decide).
          const gruposPorCat = new Map();
          for (const it of itensValidados) {
            const catId = it.variacao.produto.categoriaId || null;
            if (!gruposPorCat.has(catId)) gruposPorCat.set(catId, []);
            gruposPorCat.get(catId).push(it);
          }

          for (const [catId, itensDoGrupo] of gruposPorCat.entries()) {
            const subtotalGrupo = itensDoGrupo.reduce((acc, i) => acc + i.subtotal, 0);
            const detalheItens = itensDoGrupo
              .map((it) => `${it.variacao.produto.nome} (${it.variacao.nome}) x${it.quantidade}`)
              .join(', ');
            await tx.lancamentoFinanceiro.create({
              data: {
                clienteId: contexto.clienteId,
                leadId: args.leadId || null,
                vendaId: venda.id,
                sessaoCaixaId: sessao.id,
                categoriaId: catId,
                descricao: `Receita Venda #${venda.numero}: ${detalheItens}`,
                valor: subtotalGrupo,
                tipo: 'RECEITA',
                status: 'PAGO',
                dataVencimento: new Date(),
                dataPagamento: new Date(),
              },
            });
          }

          return venda;
        });
        break; // sucesso — sai do retry loop
      } catch (err) {
        if (err?.code === 'P2002' && tentativa < MAX_RETRIES_NUMERO) {
          tentativa += 1;
          continue;
        }
        throw err;
      }
    }

    return {
      vendaId: resultado.id,
      vendaNumero: resultado.numero,
      valorTotal,
      itens: itensValidados.map((it) => ({
        produto: it.variacao.produto.nome,
        variacao: it.variacao.nome,
        quantidade: it.quantidade,
        precoUnitario: it.precoUnitario,
        subtotal: it.subtotal,
      })),
      status: resultado.status,
    };
  },
};

module.exports = [lancarVenda];
