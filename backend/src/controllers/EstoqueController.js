const prisma = require('../prisma');

class EstoqueController {

  async registrarMovimentacao(req, res) {
    let { variacaoId, tipo, quantidade, motivo, vendaId, precoCusto, precoVenda, categoriaId } = req.body;
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

    // Converter para número
    quantidade = parseInt(quantidade);

    // Validações básicas
    if (!variacaoId || !tipo || isNaN(quantidade)) {
      return res.status(400).json({
        error: 'Campos obrigatórios: variacaoId, tipo e quantidade (número).',
        campos: ['variacaoId', 'tipo', 'quantidade']
      });
    }

    try {
      const variacao = await prisma.variacaoProduto.findFirst({
        where: { id: variacaoId, produto: { clienteId } },
        include: { produto: true }
      });

      if (!variacao) {
        return res.status(404).json({ error: 'Variação não encontrada.' });
      }

      // Impedir estoque negativo em produtos físicos
      if (variacao.produto.tipo === 'FISICO' && (variacao.estoqueAtual + quantidade) < 0) {
        return res.status(422).json({
          error: `Estoque insuficiente. Saldo atual: ${variacao.estoqueAtual}.`,
          campos: ['quantidade']
        });
      }

      const resultado = await prisma.$transaction(async (tx) => {
        // 1. Registra a movimentação
        const movimentacao = await tx.movimentacaoEstoque.create({
          data: { variacaoId, tipo, quantidade, motivo, vendaId }
        });

        // 2. Atualiza saldo e preços na variação
        const variacaoAtualizada = await tx.variacaoProduto.update({
          where: { id: variacaoId },
          data: {
            estoqueAtual: { increment: quantidade },
            precoCusto: precoCusto !== undefined ? parseFloat(precoCusto) : undefined,
            preco: precoVenda !== undefined ? parseFloat(precoVenda) : undefined
          },
          include: { produto: true }
        });

        // 3. Integração Financeira Automática
        const pCusto = parseFloat(precoCusto || variacao.precoCusto || 0);
        const pVenda = parseFloat(precoVenda || variacao.preco || 0);

        if (tipo === 'COMPRA_FORNECEDOR' && quantidade > 0) {
          // ENTRADA -> DESPESA
          await tx.lancamentoFinanceiro.create({
            data: {
              clienteId,
              descricao: `Entrada de estoque: ${variacao.produto.nome} (${variacao.nome})`,
              valor: pCusto * quantidade,
              tipo: 'DESPESA',
              status: 'PAGO',
              dataVencimento: new Date(),
              dataPagamento: new Date(),
              categoriaId: categoriaId || null,
            }
          });
        } else if (tipo === 'VENDA' && quantidade < 0) {
          // SAIDA -> RECEITA
          await tx.lancamentoFinanceiro.create({
            data: {
              clienteId,
              descricao: `Venda de estoque: ${variacao.produto.nome} (${variacao.nome})`,
              valor: pVenda * Math.abs(quantidade),
              tipo: 'RECEITA',
              status: 'PAGO',
              dataVencimento: new Date(),
              dataPagamento: new Date(),
              categoriaId: categoriaId || null,
              vendaId: vendaId || null
            }
          });
        }

        return { movimentacao, novoEstoque: variacaoAtualizada.estoqueAtual };
      });

      return res.status(201).json({ success: true, data: resultado });
    } catch (error) {
      console.error('[EstoqueController]', error);
      return res.status(500).json({ error: 'Erro ao processar movimentação.' });
    }
  }

  async ajusteLote(req, res) {
    try {
      const { ajustes } = req.body; // Array de { variacaoId, novoEstoque, motivo }
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      if (!Array.isArray(ajustes)) return res.status(400).json({ error: 'Array de ajustes obrigatório.' });

      const resultado = await prisma.$transaction(async (tx) => {
        const processados = [];
        for (const item of ajustes) {
          const variacao = await tx.variacaoProduto.findFirst({
            where: { id: item.variacaoId, produto: { clienteId } },
            include: { produto: true }
          });
          if (!variacao) throw new Error(`Variação ${item.variacaoId} não encontrada.`);

          const novoEstoque = parseInt(item.novoEstoque);
          if (isNaN(novoEstoque)) throw new Error(`Estoque inválido para a variação ${variacao.nome}.`);

          // Impedir estoque negativo em produtos físicos
          if (variacao.produto.tipo === 'FISICO' && novoEstoque < 0) {
            throw new Error(`Estoque não pode ser negativo para o produto físico: ${variacao.produto.nome}.`);
          }

          const diferenca = novoEstoque - variacao.estoqueAtual;
          if (diferenca === 0) continue;

          const mov = await tx.movimentacaoEstoque.create({
            data: {
              variacaoId: item.variacaoId,
              tipo: 'AJUSTE',
              quantidade: diferenca,
              motivo: item.motivo || 'Ajuste em lote'
            }
          });

          await tx.variacaoProduto.update({
            where: { id: item.variacaoId },
            data: { estoqueAtual: novoEstoque }
          });

          processados.push(mov);
        }
        return processados;
      });

      res.json({ success: true, total: resultado.length });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Conceito de Reserva (Soft Allocation): 
   * Bloqueia temporariamente um item enquanto o pedido está em andamento.
   */
  async reservarEstoque(req, res) {
    const { variacaoId, quantidade, vendaId } = req.body;

    // Na reserva, subtraímos do estoque com o tipo 'RESERVA'
    req.body.tipo = 'RESERVA';
    req.body.quantidade = -Math.abs(quantidade);
    req.body.motivo = 'Reserva temporária para venda em andamento';

    return this.registrarMovimentacao(req, res);
  }
  /**
   * Lista todas as movimentações de estoque do cliente.
   */
  async listarMovimentacoes(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const movimentacoes = await prisma.movimentacaoEstoque.findMany({
        where: {
          variacao: {
            produto: {
              clienteId
            }
          }
        },
        include: {
          variacao: {
            include: {
              produto: true
            }
          },
          venda: true
        },
        orderBy: { data: 'desc' }
      });

      res.json(movimentacoes);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar movimentações de estoque.' });
    }
  }

  /**
   * Dashboard de Estoque: KPIs de Patrimônio, Ruptura e Saúde do Inventário.
   */
  async dashboard(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const variacoes = await prisma.variacaoProduto.findMany({
        where: { produto: { clienteId } },
        include: { produto: true }
      });

      const stats = {
        valorTotalInventario: 0, // Soma de (estoqueAtual * precoCusto)
        itensAbaixoMinimo: 0,    // estoqueAtual < estoqueMinimo
        indiceRuptura: 0,        // (itens zerados / total) * 100
        totalProdutos: variacoes.length,
        distribuicaoPorTipo: {}, // Físico vs Serviço (embora estoque seja mais para físico)
      };

      let itensZerados = 0;

      variacoes.forEach(v => {
        const estoque = v.estoqueAtual || 0;
        const custo = v.precoCusto || 0;
        
        stats.valorTotalInventario += (estoque * custo);

        if (v.estoqueMinimo !== null && estoque < v.estoqueMinimo) {
          stats.itensAbaixoMinimo++;
        }

        if (estoque <= 0) {
          itensZerados++;
        }
      });

      stats.indiceRuptura = variacoes.length > 0 
        ? parseFloat(((itensZerados / variacoes.length) * 100).toFixed(2)) 
        : 0;

      res.json(stats);
    } catch (error) {
      console.error('[EstoqueController.dashboard]', error);
      res.status(500).json({ error: 'Erro ao gerar dashboard de estoque.' });
    }
  }

  /**
   * Lista de Reposição: Itens que precisam de compra baseados no estoque ideal.
   */
  async listaReposicao(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const itensParaRepor = await prisma.variacaoProduto.findMany({
        where: {
          produto: { clienteId },
          OR: [
            { estoqueAtual: { lt: prisma.variacaoProduto.fields.estoqueMinimo } },
            { estoqueAtual: { lt: prisma.variacaoProduto.fields.estoqueIdeal } }
          ]
        },
        include: { produto: true },
        orderBy: { estoqueAtual: 'asc' }
      });

      // Cálculo da necessidade. Inclui imagemUrl (da variacao ou fallback pro
      // produto) pra UI exibir thumb na lista de reposicao.
      const resultado = itensParaRepor.map(item => ({
        id: item.id,
        produto: item.produto.nome,
        variacao: item.nome,
        imagemUrl: item.imagemUrl || item.produto.imagemUrl || null,
        estoqueAtual: item.estoqueAtual,
        estoqueMinimo: item.estoqueMinimo,
        estoqueIdeal: item.estoqueIdeal,
        necessidade: (item.estoqueIdeal || 0) - item.estoqueAtual,
        urgencia: (item.estoqueMinimo !== null && item.estoqueAtual < item.estoqueMinimo) ? 'ALTA' : 'MEDIA'
      }));

      res.json(resultado);
    } catch (error) {
      console.error('[EstoqueController.listaReposicao]', error);
      res.status(500).json({ error: 'Erro ao listar reposição.' });
    }
  }

  /**
   * Ajuste de Balanço (Inventário Físico): Sobrescreve o estoque atual com o contado.
   */
  async ajusteBalanco(req, res) {
    try {
      const { ajustes } = req.body; // Array de { variacaoId, estoqueReal, motivo }
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      if (!Array.isArray(ajustes)) {
        return res.status(400).json({ error: 'Array de ajustes é obrigatório.' });
      }

      const resultado = await prisma.$transaction(async (tx) => {
        const logs = [];

        for (const item of ajustes) {
          const variacao = await tx.variacaoProduto.findFirst({
            where: { id: item.variacaoId, produto: { clienteId } },
            include: { produto: true }
          });

          if (!variacao) continue;

          const estoqueReal = parseInt(item.estoqueReal);
          if (isNaN(estoqueReal)) continue;

          // Impedir estoque negativo em produtos físicos
          if (variacao.produto.tipo === 'FISICO' && estoqueReal < 0) {
            throw new Error(`Estoque não pode ser negativo para: ${variacao.produto.nome}.`);
          }

          const diferenca = estoqueReal - variacao.estoqueAtual;
          if (diferenca === 0) continue;

          // Registra a movimentação de ajuste
          await tx.movimentacaoEstoque.create({
            data: {
              variacaoId: item.variacaoId,
              tipo: 'AJUSTE',
              quantidade: diferenca,
              motivo: item.motivo || 'Ajuste de Balanço (Inventário Físico)'
            }
          });

          // Atualiza o saldo real
          await tx.variacaoProduto.update({
            where: { id: item.variacaoId },
            data: { estoqueAtual: estoqueReal }
          });

          logs.push({
            id: variacao.id,
            de: variacao.estoqueAtual,
            para: estoqueReal,
            diferenca
          });
        }

        return logs;
      });

      res.json({ success: true, processados: resultado.length, detalhes: resultado });
    } catch (error) {
      console.error('[EstoqueController.ajusteBalanco]', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Consulta o saldo atual e o histórico de uma variação específica.
   */
  async buscarSaldoPorVariacao(req, res) {
    try {
      const { variacaoId } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const variacao = await prisma.variacaoProduto.findFirst({
        where: {
          id: variacaoId,
          produto: { clienteId }
        },
        include: {
          produto: true,
          movimentacoes: {
            orderBy: { data: 'desc' },
            take: 50
          }
        }
      });

      if (!variacao) {
        return res.status(404).json({ error: 'Variação não encontrada.' });
      }

      res.json(variacao);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar saldo da variação.' });
    }
  }
}

module.exports = new EstoqueController();
