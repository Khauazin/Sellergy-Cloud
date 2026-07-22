const prisma = require('../prisma');

class CmvController {

  async relatorioCustos(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { inicio, fim } = req.query;

      const movimentacoes = await prisma.movimentacaoEstoque.findMany({
        where: {
          variacao: { produto: { clienteId } },
          tipo: 'VENDA',
          data: {
            gte: inicio ? new Date(inicio) : undefined,
            lte: fim ? new Date(fim) : undefined
          }
        },
        include: {
          variacao: true
        }
      });

      const totalCusto = movimentacoes.reduce((acc, mov) => {
        // Custo CONGELADO da venda (snapshot do momento). Fallback pro custo
        // atual da variacao em vendas antigas (antes do snapshot existir).
        const custoUnit = mov.custoUnitario ?? mov.variacao?.precoCusto ?? 0;
        // Quantidade em VENDA costuma ser negativa no ledger, usamos valor absoluto
        return acc + (Math.abs(mov.quantidade) * custoUnit);
      }, 0);

      res.json({
        periodo: { inicio, fim },
        totalCusto: Number(totalCusto.toFixed(2)),
        quantidadeMovimentacoes: movimentacoes.length
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao gerar relatório de custos' });
    }
  }

  /**
   * Margem por produto e por variação
   */
  async relatorioMargens(req, res) {
    try {
      const { clienteId } = req.usuario;

      const produtos = await prisma.produto.findMany({
        where: { clienteId },
        include: {
          variacoes: true
        }
      });

      const margens = produtos.map(p => ({
        produtoId: p.id,
        nome: p.nome,
        variacoes: p.variacoes.map(v => {
          const margemAbsoluta = v.preco - (v.precoCusto || 0);
          const margemPercentual = v.preco > 0 ? (margemAbsoluta / v.preco) * 100 : 0;
          return {
            variacaoId: v.id,
            nome: v.nome,
            precoVenda: v.preco,
            precoCusto: v.precoCusto,
            margemAbsoluta: Number(margemAbsoluta.toFixed(2)),
            margemPercentual: Number(margemPercentual.toFixed(2))
          };
        })
      }));

      res.json(margens);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao calcular margens' });
    }
  }

  /**
   * CMV total vs receita no período (lucratividade geral)
   */
  async relatorioLucratividade(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { inicio, fim } = req.query;

      const onde = {
        variacao: { produto: { clienteId } },
        tipo: 'VENDA',
        data: {
          gte: inicio ? new Date(inicio) : undefined,
          lte: fim ? new Date(fim) : undefined
        }
      };

      const movimentacoes = await prisma.movimentacaoEstoque.findMany({
        where: onde,
        include: { variacao: true }
      });

      let receitaTotal = 0;
      let custoTotal = 0;

      movimentacoes.forEach(mov => {
        const qtd = Math.abs(mov.quantidade);
        receitaTotal += qtd * mov.variacao.preco;
        // Custo congelado da venda (snapshot); fallback pro custo atual em vendas antigas.
        custoTotal += qtd * (mov.custoUnitario ?? mov.variacao?.precoCusto ?? 0);
      });

      const lucroBruto = receitaTotal - custoTotal;
      const margemContribuicao = receitaTotal > 0 ? (lucroBruto / receitaTotal) * 100 : 0;

      res.json({
        receitaTotal: Number(receitaTotal.toFixed(2)),
        custoTotalCMV: Number(custoTotal.toFixed(2)),
        lucroBruto: Number(lucroBruto.toFixed(2)),
        margemContribuicao: Number(margemContribuicao.toFixed(2))
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro no relatório de lucratividade' });
    }
  }
}

module.exports = new CmvController();
