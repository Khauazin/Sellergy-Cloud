const prisma = require('../prisma');
const crypto = require('crypto');

const CAMPOS_OBRIGATORIOS_LANCAMENTO = ['descricao', 'valor', 'tipo', 'dataVencimento',];
const TIPOS_VALIDOS = ['RECEITA', 'DESPESA'];
const STATUS_VALIDOS_LANCAMENTO = ['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO'];

function validarCampos(corpo, campos) {
  return campos.filter(
    c => corpo[c] === undefined || corpo[c] === null || corpo[c] === ''
  );
}

async function buscarLancamentoDoCliente(id, clienteId) {
  const lancamento = await prisma.lancamentoFinanceiro.findUnique({
    where: { id },
    include: { lead: true }
  })
  if (!lancamento) return null;
  if (lancamento.clienteId !== clienteId) return null;
  return lancamento;
}

class FinanceiroController {

  // Lançamentos
  async listarLancamentos(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { tipo, status, inicio, fim, pagina = 1, limite = 50, buscar } = req.query;

      const paginaNum = Math.max(1, parseInt(pagina))
      const limiteNum = Math.min(100, Math.max(1, parseInt(limite)))

      const onde = {
        clienteId: clienteId,
        tipo: tipo || undefined,
        status: status || undefined,
        descricao: buscar ? {
          contains: buscar,
          mode: 'insensitive'
        } : undefined,
        dataVencimento: {
          gte: inicio ? new Date(inicio) : undefined,
          lte: fim ? new Date(fim) : undefined
        }
      }

      const [lancamentos, total] = await prisma.$transaction([
        prisma.lancamentoFinanceiro.findMany({
          where: onde,
          include: {
            categoria: true,
            lead: { select: { nome: true } },
            venda: true
          },
          orderBy: { dataVencimento: 'desc' },
          skip: (paginaNum - 1) * limiteNum,
          take: limiteNum
        }),
        prisma.lancamentoFinanceiro.count({
          where: onde
        })
      ]);

      const dadosComAtrasoVirtual = lancamentos.map(l => {
        const diasAtraso = l.status === 'PENDENTE' && new Date(l.dataVencimento) < new Date()
          ? Math.floor((new Date() - new Date(l.dataVencimento)) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          ...l,
          estaAtrasado: diasAtraso > 0,
          diasAtraso,
          valorAtualizado: diasAtraso > 0 ? Number((l.valor * (1 + (diasAtraso * 0.00033) + 0.02)).toFixed(2)) : l.valor
        };
      });

      res.json({
        dados: dadosComAtrasoVirtual,
        paginacao: {
          total,
          pagina: paginaNum,
          limite: limiteNum,
          paginas: Math.ceil(total / limiteNum)
        }
      });
    } catch (error) {
      console.error('[listaLancamentos]', error);
      res.status(500).json({ error: 'Erro ao listar lançamentos' });
    }
  }

  async criarLancamento(req, res) {
    try {
      const { clienteId } = req.usuario;
      const {
        descricao, valor, tipo, dataVencimento,
        categoriaId, leadId, vendaId, parcelas = 1
      } = req.body;

      let { status, dataPagamento } = req.body;
      status = status || 'PENDENTE';

      const ausentes = validarCampos(req.body, CAMPOS_OBRIGATORIOS_LANCAMENTO);
      if (ausentes.length > 0) {
        return res.status(422).json({
          error: 'Campos obrigatórios ausentes',
          campos: ausentes
        });
      }

      if (typeof valor !== 'number' || valor <= 0) {
        return res.status(422).json({
          error: 'O valor deve ser um número positivo.',
          campos: ['valor']
        });
      }

      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(422).json({
          error: 'Tipo inválido. Use RECEITA ou DESPESA',
          campos: ['tipo']
        });
      }

      if (!STATUS_VALIDOS_LANCAMENTO.includes(status)) {
        return res.status(422).json({
          error: 'Status inválido. Use PENDENTE, PAGO, ATRASADO ou CANCELADO',
          campo: 'status'
        });
      }

      if (status === 'PAGO' && !dataPagamento) {
        return res.status(422).json({
          error: 'dataPagamento é obrigatório quando status é PAGO',
          campo: 'dataPagamento'
        });
      }

      if (categoriaId) {
        const cat = await prisma.categoriaFinanceira.findFirst({
          where: { id: categoriaId, clienteId }
        });
        if (!cat) return res.status(400).json({ error: 'Categoria não encontrada' });
      }

      const lancamentosParaCriar = [];
      const valorParcela = Number((valor / parcelas).toFixed(2));
      const diferencaCentavos = Number((valor - (valorParcela * parcelas)).toFixed(2));
      const idAgrupamento = parcelas > 1 ? crypto.randomUUID() : null;
      const dataBase = new Date(dataVencimento);

      for (let i = 0; i < parcelas; i++) {
        const dataVencimentoParcela = new Date(dataBase);
        dataVencimentoParcela.setMonth(dataBase.getMonth() + i);
        if (dataVencimentoParcela.getDate() !== dataBase.getDate()) dataVencimentoParcela.setDate(0);

        const valorFinalDestaParcela = (i === parcelas - 1) ? valorParcela + diferencaCentavos : valorParcela;

        lancamentosParaCriar.push({
          clienteId,
          descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas})` : descricao,
          valor: valorFinalDestaParcela,
          tipo,
          dataVencimento: dataVencimentoParcela,
          status: i === 0 ? status : 'PENDENTE',
          dataPagamento: (i === 0 && status === 'PAGO') ? (dataPagamento ? new Date(dataPagamento) : new Date()) : null,
          categoriaId: categoriaId || null,
          leadId: leadId || null,
          vendaId: vendaId || null,
          idAgrupamento: idAgrupamento,
        });
      }

      if (parcelas > 1) {
        await prisma.lancamentoFinanceiro.createMany({ data: lancamentosParaCriar });
        res.status(201).json({ mensagem: `${parcelas} parcelas criadas.`, total: valor });
      } else {
        const lancamento = await prisma.lancamentoFinanceiro.create({ data: lancamentosParaCriar[0] });
        res.status(201).json(lancamento);
      }
    } catch (error) {
      console.error('[criarLancamento]', error);
      res.status(500).json({ error: 'Erro ao criar lançamento financeiro' });
    }
  }

  async editarLancamento(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const dados = req.body;
      const existente = await buscarLancamentoDoCliente(id, clienteId);
      if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });
      if (existente.status === 'PAGO') return res.status(422).json({ error: 'Não é possível editar um lançamento já pago.' });

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: {
          descricao: dados.descricao,
          valor: dados.valor,
          tipo: dados.tipo,
          dataVencimento: dados.dataVencimento ? new Date(dados.dataVencimento) : undefined,
          categoriaId: dados.categoriaId,
          leadId: dados.leadId,
          vendaId: dados.vendaId
        }
      });
      res.json(lancamento);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao editar lançamento' });
    }
  }

  async atualizarStatus(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const { status, dataPagamento, dataCancelamento } = req.body;
      const existente = await buscarLancamentoDoCliente(id, clienteId);
      if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: {
          status,
          dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
          dataCancelamento: dataCancelamento ? new Date(dataCancelamento) : undefined
        }
      });
      res.json(lancamento);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  }

  async dashboard(req, res) {
    try {
      const { clienteId } = req.usuario;
      const hoje = new Date();
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(hoje.getDate() - 7);

      const [agregados, vencidos, historicoRecuperacao] = await prisma.$transaction([
        prisma.lancamentoFinanceiro.groupBy({
          by: ['tipo', 'status'],
          where: { clienteId },
          _sum: { valor: true }
        }),
        prisma.lancamentoFinanceiro.aggregate({
          where: { clienteId, status: 'PENDENTE', tipo: 'RECEITA', dataVencimento: { lt: hoje } },
          _sum: { valor: true }
        }),
        prisma.lancamentoFinanceiro.count({
          where: { clienteId, status: 'PAGO', atualizadoEm: { gte: seteDiasAtras }, dataVencimento: { lt: hoje } }
        })
      ]);

      const resumo = { receita: 0, despesa: 0, saldo: 0, pendenteReceita: 0, pendenteDespesa: 0 };
      agregados.forEach(a => {
        const valor = a._sum.valor || 0;
        if (a.tipo === 'RECEITA') {
          if (a.status === 'PAGO') resumo.receita += valor;
          else resumo.pendenteReceita += valor;
        } else {
          if (a.status === 'PAGO') resumo.despesa += valor;
          else resumo.pendenteDespesa += valor;
        }
      });

      const saldoEmRisco = vencidos._sum.valor || 0;
      const totalVencidosSemana = await prisma.lancamentoFinanceiro.count({
        where: { clienteId, tipo: 'RECEITA', dataVencimento: { gte: seteDiasAtras, lt: hoje } }
      });
      const indiceEficacia = totalVencidosSemana > 0 ? (historicoRecuperacao / totalVencidosSemana) * 100 : 0;

      res.json({
        resumo: { ...resumo, saldo: resumo.receita - resumo.despesa },
        kpis: {
          saldoEmRisco,
          indiceEficacia: Number(indiceEficacia.toFixed(2)),
          previsaoRecuperacao: Number((saldoEmRisco * (indiceEficacia / 100)).toFixed(2))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro no dashboard' });
    }
  }

  async inadimplencia(req, res) {
    try {
      const { clienteId } = req.usuario;
      const hoje = new Date();
      const atrasados = await prisma.lancamentoFinanceiro.findMany({
        where: { clienteId, status: 'PENDENTE', dataVencimento: { lt: hoje }, tipo: 'RECEITA' },
        include: { lead: { select: { id: true, nome: true, telefone: true } } },
        orderBy: { dataVencimento: 'asc' }
      });

      const dadosEnriquecidos = atrasados.map(l => {
        const dias = Math.floor((hoje - new Date(l.dataVencimento)) / (1000 * 60 * 60 * 24));
        let risco = 'BAIXO';
        if (dias > 30) risco = 'CRÍTICO'; else if (dias > 7) risco = 'ALTO';

        return {
          ...l,
          aging: dias,
          nivelRisco: risco,
          valorAtualizado: Number((l.valor * (1 + (dias * 0.00033) + 0.02)).toFixed(2)),
          acoesRecomendadas: dias > 7 ? ['NEGOCIACAO', 'COBRANCA_CRITICA'] : ['LEMBRETE_AMIGAVEL', 'PIX_RAPIDO']
        };
      });

      res.json({
        resumo: { totalAtrasado: dadosEnriquecidos.reduce((a, b) => a + b.valor, 0), quantidade: atrasados.length },
        clientesInadimplentes: dadosEnriquecidos
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro na inadimplência' });
    }
  }

  async pausaAmigavel(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const { dias = 3 } = req.body;
      const lancamento = await buscarLancamentoDoCliente(id, clienteId);
      if (!lancamento) return res.status(404).json({ error: 'Lançamento não encontrado' });

      const novaData = new Date(lancamento.dataVencimento);
      novaData.setDate(novaData.getDate() + dias);

      const atualizado = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: { dataVencimento: novaData, motivoCancelamento: `Pausa amigável aplicada em ${new Date().toLocaleDateString()}` }
      });
      res.json({ mensagem: 'Vencimento postergado.', novoVencimento: atualizado.dataVencimento });
    } catch (error) {
      res.status(500).json({ error: 'Erro na pausa amigável' });
    }
  }

  async cobrarLancamento(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const lancamento = await buscarLancamentoDoCliente(id, clienteId);
      if (!lancamento || !lancamento.lead?.telefone) return res.status(400).json({ error: 'Dados insuficientes' });

      const mensagem = `Olá ${lancamento.lead.nome}, identificamos sua fatura em aberto. Pode pagar via Pix?`;
      const linkWpp = `https://wa.me/${lancamento.lead.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`;
      res.json({ tipo: 'WHATSAPP_ACTION', link: linkWpp });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao cobrar' });
    }
  }

  async relatorioDRE(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { inicio, fim } = req.query;
      const lancamentos = await prisma.lancamentoFinanceiro.findMany({
        where: { clienteId, status: 'PAGO', dataPagamento: { gte: inicio ? new Date(inicio) : undefined, lte: fim ? new Date(fim) : undefined } },
        include: { categoria: true }
      });

      const dre = { receitaBruta: 0, despesasVariaveis: 0, despesasFixas: 0, resultadoLiquido: 0 };
      lancamentos.forEach(l => {
        const cat = l.categoria?.nome?.toLowerCase() || '';
        if (l.tipo === 'RECEITA') dre.receitaBruta += l.valor;
        else if (cat.includes('venda') || cat.includes('imposto')) dre.despesasVariaveis += l.valor;
        else dre.despesasFixas += l.valor;
      });
      dre.resultadoLiquido = dre.receitaBruta - dre.despesasVariaveis - dre.despesasFixas;
      res.json(dre);
    } catch (error) {
      res.status(500).json({ error: 'Erro no DRE' });
    }
  }

  // CRUD Categorias
  async listarCategorias(req, res) {
    const categorias = await prisma.categoriaFinanceira.findMany({ where: { clienteId: req.usuario.clienteId }, orderBy: { nome: 'asc' } });
    res.json(categorias);
  }

  async criarCategoria(req, res) {
    const { nome, tipo } = req.body;
    const cat = await prisma.categoriaFinanceira.create({ data: { clienteId: req.usuario.clienteId, nome, tipo } });
    res.status(201).json(cat);
  }

  async editarCategoria(req, res) {
    const { id } = req.params;
    const cat = await prisma.categoriaFinanceira.update({ where: { id, clienteId: req.usuario.clienteId }, data: req.body });
    res.json(cat);
  }

  async excluirCategoria(req, res) {
    const { id } = req.params;
    await prisma.categoriaFinanceira.delete({ where: { id, clienteId: req.usuario.clienteId } });
    res.json({ mensagem: 'Excluída' });
  }

  async saldoAtual(req, res) {
    const ultimo = await prisma.saldoHistorico.findFirst({ where: { clienteId: req.usuario.clienteId }, orderBy: { data: 'desc' } });
    res.json({ saldo: ultimo?.valor || 0 });
  }

  async ajustarSaldo(req, res) {
    const novo = await prisma.saldoHistorico.create({ data: { clienteId: req.usuario.clienteId, valor: parseFloat(req.body.valor), motivo: req.body.motivo } });
    res.status(201).json(novo);
  }

  async excluirLancamento(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const existente = await buscarLancamentoDoCliente(id, clienteId);
      if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });

      await prisma.lancamentoFinanceiro.delete({ where: { id } });
      res.json({ message: 'Lançamento excluído com sucesso.' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir lançamento' });
    }
  }

  async cancelarLancamento(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const { motivo } = req.body;
      const existente = await buscarLancamentoDoCliente(id, clienteId);
      if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: {
          status: 'CANCELADO',
          dataCancelamento: new Date(),
          motivoCancelamento: motivo
        }
      });
      res.json(lancamento);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao cancelar lançamento' });
    }
  }

  async resumo(req, res) {
    try {
      const { clienteId } = req.usuario;
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

      const agregados = await prisma.lancamentoFinanceiro.groupBy({
        by: ['tipo', 'status'],
        where: {
          clienteId,
          dataVencimento: { gte: inicioMes, lte: fimMes }
        },
        _sum: { valor: true }
      });

      const resumo = { entradas: 0, saidas: 0, saldo: 0 };
      agregados.forEach(a => {
        if (a.status === 'PAGO') {
          if (a.tipo === 'RECEITA') resumo.entradas += a._sum.valor || 0;
          else resumo.saidas += a._sum.valor || 0;
        }
      });
      resumo.saldo = resumo.entradas - resumo.saidas;

      res.json(resumo);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar resumo financeiro' });
    }
  }

  async atualizarStatusEmLote(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { ids, status } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'IDs inválidos.' });
      }

      const resultado = await prisma.lancamentoFinanceiro.updateMany({
        where: { id: { in: ids }, clienteId },
        data: {
          status,
          dataPagamento: status === 'PAGO' ? new Date() : null
        }
      });

      res.json({ mensagem: 'Status atualizado com sucesso.', alterados: resultado.count });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar em lote' });
    }
  }

  async excluirGrupo(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { idAgrupamento } = req.params;

      if (!idAgrupamento) return res.status(400).json({ error: 'ID de agrupamento inválido.' });

      const resultado = await prisma.lancamentoFinanceiro.deleteMany({
        where: { idAgrupamento, clienteId, status: { not: 'PAGO' } }
      });

      res.json({ mensagem: 'Parcelas não pagas excluídas.', excluidas: resultado.count });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir grupo' });
    }
  }

  async fluxoCaixa(req, res) {
    const hoje = new Date();
    const fim = new Date(); fim.setDate(hoje.getDate() + 30);
    const lancamentos = await prisma.lancamentoFinanceiro.findMany({ where: { clienteId: req.usuario.clienteId, dataVencimento: { gte: hoje, lte: fim } } });
    res.json(lancamentos);
  }
}

module.exports = new FinanceiroController();
