// Tool de venda. Espelha a logica do VendaController (cria Venda +
// MovimentacaoEstoque + LancamentoFinanceiro em transacao). O preco e
// sempre resolvido pelo helper produto.resolverPrecoVenda — o agente NAO
// pode arbitrar preco diferente sem instrucao explicita do prompt.

const prisma = require('../../prisma');
const { resolverPrecoVenda } = require('../../produto');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

const lancarVenda = {
  nome: 'vendas.lancarVenda',
  modulo: 'VENDAS',
  descricao:
    'Registra uma venda. Decrementa o estoque e cria lancamento financeiro como receita PAGA. ' +
    'O preco unitario e calculado pela regra do helper (catalogo prevalece sobre estoque quando a flag esta ligada).',
  parametros: {
    tipo: 'object',
    propriedades: {
      variacaoId: { tipo: 'string', descricao: 'ID da variacao do produto' },
      quantidade: { tipo: 'number', descricao: 'Quantidade vendida (>= 1)' },
      leadId: { tipo: 'string', descricao: 'Lead vinculado (opcional)', opcional: true },
      metodoPagamento: { tipo: 'string', descricao: 'PIX, DINHEIRO, CARTAO, etc.', opcional: true },
      observacoes: { tipo: 'string', opcional: true },
      categoriaFinanceiraId: { tipo: 'string', descricao: 'Categoria financeira do lancamento (opcional)', opcional: true },
    },
    obrigatorios: ['variacaoId', 'quantidade'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);

    const quantidade = parseInt(args.quantidade, 10);
    if (!Number.isFinite(quantidade) || quantidade < 1) {
      throw new Error('quantidade deve ser inteiro >= 1.');
    }

    const variacao = await prisma.variacaoProduto.findFirst({
      where: { id: args.variacaoId, produto: { clienteId: contexto.clienteId } },
      include: { produto: true },
    });
    if (!variacao) throw new Error('Variacao nao encontrada (ou nao pertence ao tenant).');

    if (variacao.produto.tipo === 'FISICO' && variacao.estoqueAtual - quantidade < 0) {
      throw new Error(`Estoque insuficiente. Disponivel: ${variacao.estoqueAtual}, solicitado: ${quantidade}.`);
    }

    const precoUnitario = resolverPrecoVenda(variacao);
    const valorTotal = precoUnitario * quantidade;

    const resultado = await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.create({
        data: {
          clienteId: contexto.clienteId,
          leadId: args.leadId || null,
          valor: valorTotal,
          metodoPagamento: args.metodoPagamento ? String(args.metodoPagamento).trim() : null,
          descricao: args.observacoes ? String(args.observacoes).trim() : `${variacao.produto.nome} (${variacao.nome}) x${quantidade}`,
          status: 'COMPLETED',
        },
      });

      await tx.movimentacaoEstoque.create({
        data: {
          variacaoId: variacao.id,
          tipo: 'VENDA',
          quantidade: -Math.abs(quantidade),
          motivo: `Venda #${venda.id} (agente)`,
          vendaId: venda.id,
        },
      });
      await tx.variacaoProduto.update({
        where: { id: variacao.id },
        data: { estoqueAtual: { increment: -Math.abs(quantidade) } },
      });

      await tx.lancamentoFinanceiro.create({
        data: {
          clienteId: contexto.clienteId,
          leadId: args.leadId || null,
          vendaId: venda.id,
          categoriaId: args.categoriaFinanceiraId || null,
          descricao: `Receita Venda: ${variacao.produto.nome} (${variacao.nome})`,
          valor: valorTotal,
          tipo: 'RECEITA',
          status: 'PAGO',
          dataVencimento: new Date(),
          dataPagamento: new Date(),
        },
      });

      return venda;
    });

    return {
      vendaId: resultado.id,
      valorTotal,
      precoUnitario,
      quantidade,
      status: resultado.status,
    };
  },
};

module.exports = [lancarVenda];
