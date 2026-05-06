const prisma = require('../prisma');

class VendaController {

  async registrarVenda(req, res) {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
    
    let {
      leadId,
      variacaoId,
      quantidade,
      valorTotal,
      metodoPagamento,
      observacoes,
      categoriaId
    } = req.body;

    // Converter para número e validar
    quantidade = parseInt(quantidade);
    valorTotal = parseFloat(valorTotal);

    if (!variacaoId || isNaN(quantidade) || isNaN(valorTotal)) {
      return res.status(400).json({
        error: 'Campos obrigatórios: variacaoId, quantidade (número) e valorTotal (número).',
        campos: ['variacaoId', 'quantidade', 'valorTotal']
      });
    }

    if (quantidade <= 0) {
      return res.status(422).json({ error: 'A quantidade deve ser maior que zero.' });
    }

    try {
      const variacao = await prisma.variacaoProduto.findFirst({
        where: { id: variacaoId, produto: { clienteId } },
        include: { produto: true }
      });

      if (!variacao) return res.status(404).json({ error: 'Variação não encontrada.' });

      // Impedir estoque negativo em produtos físicos
      if (variacao.produto.tipo === 'FISICO' && (variacao.estoqueAtual - quantidade) < 0) {
        return res.status(422).json({ 
          error: `Estoque insuficiente. Disponível: ${variacao.estoqueAtual}, Solicitado: ${quantidade}.`,
          disponivel: variacao.estoqueAtual
        });
      }

      const resultado = await prisma.$transaction(async (tx) => {

        // 1. Criar a Venda
        const venda = await tx.venda.create({
          data: {
            clienteId,
            leadId,
            valor: valorTotal,
            metodoPagamento,
            descricao: observacoes,
            status: 'COMPLETED'
          }
        });

        // 2. Registrar Saída de Estoque
        const movimentacao = await tx.movimentacaoEstoque.create({
          data: {
            variacaoId,
            tipo: 'VENDA',
            quantidade: -Math.abs(quantidade),
            motivo: `Venda #${venda.id}`,
            vendaId: venda.id
          }
        });

        // Atualizar saldo na Variação
        await tx.variacaoProduto.update({
          where: { id: variacaoId },
          data: {
            estoqueAtual: {
              increment: -Math.abs(quantidade)
            }
          }
        });

        // 3. Criar Lançamento Financeiro com vínculo de categoria
        const lancamento = await tx.lancamentoFinanceiro.create({
          data: {
            clienteId,
            leadId,
            vendaId: venda.id,
            categoriaId: categoriaId || null,
            descricao: `Receita Venda: ${variacao.produto.nome} (${variacao.nome})`,
            valor: valorTotal,
            tipo: 'RECEITA',
            status: 'PAGO',
            dataVencimento: new Date(),
            dataPagamento: new Date()
          }
        });

        return { venda, movimentacao, lancamento };
      });

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
        // 1. Marca venda como cancelada
        const atualizada = await tx.venda.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            dataCancelamento: agora,
            motivoCancelamento: motivo || null,
            canceladaPorId: usuarioId || null,
          },
        });

        // 2. Estorna estoque para CADA movimentação tipo VENDA dessa venda.
        // Cria movimentação DEVOLUCAO com sinal positivo (compensa o negativo
        // original) e atualiza saldo da variação.
        for (const m of venda.movimentacoesEstoque || []) {
          if (m.tipo !== 'VENDA') continue;
          const qtdEstorno = Math.abs(m.quantidade);
          await tx.movimentacaoEstoque.create({
            data: {
              variacaoId: m.variacaoId,
              tipo: 'DEVOLUCAO',
              quantidade: qtdEstorno,
              motivo: `Cancelamento da venda #${venda.id}${motivo ? ` — ${motivo}` : ''}`,
              vendaId: venda.id,
            },
          });
          await tx.variacaoProduto.update({
            where: { id: m.variacaoId },
            data: { estoqueAtual: { increment: qtdEstorno } },
          });
        }

        // 3. Cancela lançamentos financeiros vinculados (que ainda não estão
        // cancelados). Marca data e motivo.
        for (const l of venda.lancamentosFinanceiros || []) {
          if (l.status === 'CANCELADO') continue;
          await tx.lancamentoFinanceiro.update({
            where: { id: l.id },
            data: {
              status: 'CANCELADO',
              dataCancelamento: agora,
              motivoCancelamento: motivo
                ? `Cancelamento da venda — ${motivo}`
                : 'Cancelamento da venda',
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
   * Lista as vendas do cliente.
   */
  async listarVendas(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
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
        orderBy: { criadoEm: 'desc' }
      });
      res.json(vendas);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao listar vendas.' });
    }
  }
}

module.exports = new VendaController();
