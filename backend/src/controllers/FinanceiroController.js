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

// =====================================================================
// PROTECAO DE INTEGRIDADE FINANCEIRA
// =====================================================================
// Lancamento gerado por venda (vendaId !== null) NAO pode ser editado,
// excluido ou cancelado pelo modulo Financeiro. Pra reverter, o usuario
// precisa cancelar a VENDA inteira (POST /vendas/:id/cancelar), o que
// reverte estoque + cancela o lancamento na mesma transacao.
//
// Isso vale pra TODOS os perfis (inclusive CLIENT e ADMIN do tenant) —
// nao e questao de permissao, e questao de integridade contabil.
// Auditoria: cada cancelamento de venda fica registrado no banco.
const MSG_BLOQUEIO_VENDA = 'Este lancamento foi gerado por uma venda. Pra editar/cancelar, va em Vendas e cancele a venda — isso reverte estoque e este lancamento juntos.';

function bloquearSeVendaVinculada(lancamento) {
  if (lancamento && lancamento.vendaId) {
    return { erro: MSG_BLOQUEIO_VENDA, status: 422 };
  }
  return null;
}

// =====================================================================
// REGRAS DE NEGOCIO TEMPORAIS
// =====================================================================

// 'ATRASADO' nao deve ser um status persistido — e derivado da data.
// Calcula em tempo de leitura: PENDENTE + vencimento < hoje (00:00) = ATRASADO.
// Mantemos o status original no banco; expomos `statusEfetivo` no response.
function calcularStatusEfetivo(lanc) {
  if (!lanc) return null;
  if (lanc.status !== 'PENDENTE') return lanc.status;
  // Comparacao por DIA em America/Sao_Paulo — sem isso, servidor em UTC marca
  // como atrasado 1-3h cedo pra usuarios BRT (mesma armadilha que a Agenda
  // ja teve). Compara strings YYYY-MM-DD lexicograficamente.
  const TZ = 'America/Sao_Paulo';
  const hojeBRT = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const vencBRT = new Date(lanc.dataVencimento).toLocaleDateString('en-CA', { timeZone: TZ });
  return vencBRT < hojeBRT ? 'ATRASADO' : 'PENDENTE';
}

// IMUTABILIDADE DE MES FECHADO
// Lancamento PAGO de mes anterior ao atual e imutavel (semantica contabil:
// "mes fechado"). Permite ajustar erros do mes corrente, mas trava historico.
// Lancamentos de venda ja sao bloqueados pelo bloquearSeVendaVinculada.
function ehMesFechadoImutavel(lanc) {
  if (!lanc) return false;
  if (lanc.status !== 'PAGO') return false;
  const ref = lanc.dataPagamento || lanc.dataVencimento;
  if (!ref) return false;
  // Comparacao por ANO-MES em America/Sao_Paulo (mesma razao do statusEfetivo).
  const TZ = 'America/Sao_Paulo';
  const hojeYM = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
  const refYM = new Date(ref).toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
  return refYM < hojeYM;
}

const MSG_BLOQUEIO_MES_FECHADO = 'Lancamento de mes fechado (pago em mes anterior) e imutavel pra preservar relatorios. Pra ajustar, crie um lancamento compensatorio no mes atual.';

// =====================================================================
// AUDITORIA — log de mudancas em lancamentos
// =====================================================================
// Cada acao no lancamento gera 1 linha em HistoricoLancamento. Cache pra
// nao bater no banco buscando o nome do usuario varias vezes na mesma
// request — JWT so traz id+perfil+clienteId, nome vem do banco.
const cacheNomeUsuario = new Map();

async function obterNomeUsuario(usuarioId) {
  if (!usuarioId) return null;
  if (cacheNomeUsuario.has(usuarioId)) return cacheNomeUsuario.get(usuarioId);
  try {
    const u = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nome: true },
    });
    const nome = u?.nome || null;
    cacheNomeUsuario.set(usuarioId, nome);
    // TTL leve: limpa se cache crescer demais (sessao longa do servidor).
    if (cacheNomeUsuario.size > 200) {
      const primeira = cacheNomeUsuario.keys().next().value;
      cacheNomeUsuario.delete(primeira);
    }
    return nome;
  } catch {
    return null;
  }
}

// Best-effort: nunca quebra a operacao principal se falhar logar.
async function logHistoricoLancamento({ lancamentoId, acao, alteracoes = null, req }) {
  try {
    const usuarioId = req?.usuario?.id || null;
    const usuarioNome = await obterNomeUsuario(usuarioId);
    await prisma.historicoLancamento.create({
      data: { lancamentoId, acao, alteracoes, usuarioId, usuarioNome },
    });
  } catch (e) {
    console.error('[financeiro/historico] falha ao logar', e?.message);
  }
}

// Diff entre antes e depois — so campos efetivamente mudados.
// Ignora undefined no depois (campo nao enviado no PUT).
function calcularAlteracoesLancamento(antes, depois, campos) {
  const diff = {};
  for (const c of campos) {
    if (depois[c] === undefined) continue;
    const a = antes[c] instanceof Date ? antes[c].toISOString() : antes[c];
    const b = depois[c] instanceof Date ? depois[c].toISOString() : depois[c];
    if (a !== b) diff[c] = { de: antes[c], para: depois[c] };
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

class FinanceiroController {

  // Lançamentos
  async listarLancamentos(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { tipo, status, inicio, fim, pagina = 1, limite = 50, buscar } = req.query;

      const paginaNum = Math.max(1, parseInt(pagina))
      const limiteNum = Math.min(100, Math.max(1, parseInt(limite)))

      // Filtro ATRASADO e virtual: traduzimos pra PENDENTE + dataVencimento < hoje.
      // Os outros status (PENDENTE, PAGO, CANCELADO) vao direto pra query.
      let statusFiltro = status || undefined;
      let dataVencimentoExtra = undefined;
      if (status === 'ATRASADO') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        statusFiltro = 'PENDENTE';
        dataVencimentoExtra = { lt: hoje };
      } else if (status === 'PENDENTE') {
        // Quando o usuario pede PENDENTE 'puro', exclui os que ja deveriam estar
        // marcados como ATRASADO (vencimento passou) — UX mais intuitiva.
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataVencimentoExtra = { gte: hoje };
      }

      const onde = {
        clienteId: clienteId,
        tipo: tipo || undefined,
        status: statusFiltro,
        descricao: buscar ? {
          contains: buscar,
          mode: 'insensitive'
        } : undefined,
        dataVencimento: {
          gte: inicio ? new Date(inicio) : (dataVencimentoExtra?.gte || undefined),
          lte: fim ? new Date(fim) : undefined,
          lt: dataVencimentoExtra?.lt || undefined,
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
          // Status efetivo: ATRASADO virtual quando PENDENTE + vencimento passou.
          statusEfetivo: calcularStatusEfetivo(l),
          // Imutavel: PAGO em mes anterior = bloqueado pra edicao/exclusao.
          // Front usa pra esconder/disabled botoes.
          imutavel: ehMesFechadoImutavel(l),
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
        categoriaId, leadId, vendaId, parcelas = 1,
        produto, metodoPagamento,
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
          produto: produto || null,
          metodoPagamento: metodoPagamento || null,
        });
      }

      if (parcelas > 1) {
        // createMany nao retorna IDs — pra logar cada parcela, busca depois
        // pelo idAgrupamento. Custo aceitavel pra ter trilha auditavel.
        await prisma.lancamentoFinanceiro.createMany({ data: lancamentosParaCriar });
        const criadas = await prisma.lancamentoFinanceiro.findMany({
          where: { idAgrupamento, clienteId },
          select: { id: true, descricao: true, valor: true, dataVencimento: true, status: true },
        });
        for (const l of criadas) {
          await logHistoricoLancamento({
            lancamentoId: l.id,
            acao: 'CRIADO',
            alteracoes: { snapshot: { ...l, parcelas, idAgrupamento } },
            req,
          });
        }
        res.status(201).json({ mensagem: `${parcelas} parcelas criadas.`, total: valor });
      } else {
        const lancamento = await prisma.lancamentoFinanceiro.create({ data: lancamentosParaCriar[0] });
        await logHistoricoLancamento({
          lancamentoId: lancamento.id,
          acao: 'CRIADO',
          alteracoes: {
            snapshot: {
              descricao: lancamento.descricao,
              valor: lancamento.valor,
              tipo: lancamento.tipo,
              dataVencimento: lancamento.dataVencimento?.toISOString(),
              status: lancamento.status,
            },
          },
          req,
        });
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
      // Trava de integridade: lancamento de venda nao pode ser alterado aqui.
      const bloqueio = bloquearSeVendaVinculada(existente);
      if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.erro });
      // Trava de mes fechado — PAGO em mes anterior nao pode ser alterado.
      // PAGO do mes corrente PODE ser editado (corrigir descricao/categoria etc).
      // Auditoria fica em HistoricoLancamento.
      if (ehMesFechadoImutavel(existente)) {
        return res.status(423).json({ error: MSG_BLOQUEIO_MES_FECHADO, codigo: 'MES_FECHADO' });
      }

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: {
          descricao: dados.descricao,
          valor: dados.valor,
          tipo: dados.tipo,
          dataVencimento: dados.dataVencimento ? new Date(dados.dataVencimento) : undefined,
          categoriaId: dados.categoriaId,
          leadId: dados.leadId,
          vendaId: dados.vendaId,
          produto: dados.produto,
          metodoPagamento: dados.metodoPagamento,
        }
      });
      // Log: diff entre antes e dados recebidos. Se nada mudou, nao loga.
      const alteracoes = calcularAlteracoesLancamento(existente, {
        ...dados,
        dataVencimento: dados.dataVencimento ? new Date(dados.dataVencimento) : undefined,
      }, ['descricao', 'valor', 'tipo', 'dataVencimento', 'categoriaId', 'leadId', 'produto', 'metodoPagamento']);
      if (alteracoes) {
        await logHistoricoLancamento({ lancamentoId: id, acao: 'EDITADO', alteracoes, req });
      }
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
      // Trava de integridade: status de lancamento de venda e definido pela venda.
      const bloqueio = bloquearSeVendaVinculada(existente);
      if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.erro });
      // Trava de mes fechado: nao deixa "des-pagar" lancamento PAGO antigo.
      if (ehMesFechadoImutavel(existente)) {
        return res.status(423).json({ error: MSG_BLOQUEIO_MES_FECHADO, codigo: 'MES_FECHADO' });
      }
      // Rejeita explicitamente o status 'ATRASADO' manual — agora e derivado.
      if (status === 'ATRASADO') {
        return res.status(422).json({ error: '"Atrasado" e calculado automaticamente (vencimento passado + nao pago). Nao pode ser setado manualmente.' });
      }

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: {
          status,
          dataPagamento: dataPagamento ? new Date(dataPagamento) : undefined,
          dataCancelamento: dataCancelamento ? new Date(dataCancelamento) : undefined
        }
      });
      // Log se realmente mudou
      if (existente.status !== status) {
        await logHistoricoLancamento({
          lancamentoId: id,
          acao: 'STATUS_MUDADO',
          alteracoes: { status: { de: existente.status, para: status } },
          req,
        });
      }
      res.json(lancamento);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  }

  async dashboard(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
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
      await logHistoricoLancamento({
        lancamentoId: id,
        acao: 'ADIADO',
        alteracoes: {
          dataVencimento: {
            de: lancamento.dataVencimento?.toISOString(),
            para: novaData.toISOString(),
          },
          dias,
        },
        req,
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
      if (!lancamento || !lancamento.lead?.telefone) {
        return res.status(400).json({ error: 'Lead sem telefone cadastrado ou lancamento sem lead vinculado.' });
      }

      // Calcula variaveis pra substituir no template do front.
      const hoje = new Date();
      const vencimento = new Date(lancamento.dataVencimento);
      const diasAtrasoNum = Math.max(0, Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24)));

      const variaveis = {
        nome: lancamento.lead.nome || 'cliente',
        valor: Number(lancamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        vencimento: vencimento.toLocaleDateString('pt-BR'),
        descricao: lancamento.descricao || '',
        dias_atraso: diasAtrasoNum > 0 ? String(diasAtrasoNum) : '0',
      };

      // Template padrao com variaveis ja substituidas. Front pode mostrar
      // numa caixa editavel antes de abrir o WhatsApp.
      const ehAtrasada = diasAtrasoNum > 0;
      const mensagemPadrao = ehAtrasada
        ? `Olá ${variaveis.nome}! Notei que a fatura "${variaveis.descricao}" no valor de ${variaveis.valor}, com vencimento em ${variaveis.vencimento}, está em atraso há ${variaveis.dias_atraso} dia(s). Pode quitar via Pix? Aguardo retorno 🙏`
        : `Olá ${variaveis.nome}! Passando pra lembrar da fatura "${variaveis.descricao}" no valor de ${variaveis.valor}, com vencimento em ${variaveis.vencimento}. Pode pagar via Pix? Qualquer dúvida me avise 🙂`;

      const telefoneLimpo = lancamento.lead.telefone.replace(/\D/g, '');
      const linkBase = `https://wa.me/${telefoneLimpo}`;

      res.json({
        tipo: 'WHATSAPP_ACTION',
        telefone: telefoneLimpo,
        linkBase,
        mensagemPadrao,
        variaveis,
        // Mantem `link` legacy pra clientes antigos que ainda usam direto.
        link: `${linkBase}?text=${encodeURIComponent(mensagemPadrao)}`,
      });
    } catch (error) {
      console.error('[cobrarLancamento]', error);
      res.status(500).json({ error: 'Erro ao gerar cobranca' });
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
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      // Filtro por uso/contexto: ?uso=SERVICO ou ?uso=CAIXA,DESPESA. Sem o
      // parametro, lista todas (Configuracoes/Relatorios precisam ver tudo).
      const USOS = ['SERVICO', 'PRODUTO', 'CAIXA', 'DESPESA'];
      const where = { clienteId };
      if (req.query.uso) {
        const pedidos = String(req.query.uso).split(',').map((u) => u.trim()).filter((u) => USOS.includes(u));
        if (pedidos.length) where.uso = { in: pedidos };
      }
      const categorias = await prisma.categoriaFinanceira.findMany({ where, orderBy: { nome: 'asc' } });
      res.json(categorias);
    } catch (error) {
      console.error('[listarCategorias]', error);
      res.status(500).json({ error: 'Erro ao listar categorias' });
    }
  }

  async criarCategoria(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, tipo, subTipo, uso } = req.body;
      if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
        return res.status(422).json({ error: 'Nome obrigatório (mínimo 2 caracteres).' });
      }
      if (tipo !== 'RECEITA' && tipo !== 'DESPESA') {
        return res.status(422).json({ error: 'Tipo precisa ser RECEITA ou DESPESA.' });
      }
      // Uso/contexto é obrigatório: define onde a categoria aparece.
      const USOS = ['SERVICO', 'PRODUTO', 'CAIXA', 'DESPESA'];
      if (!USOS.includes(uso)) {
        return res.status(422).json({ error: 'Selecione onde a categoria será usada (serviço, produto, caixa ou despesa).' });
      }
      // subTipo só faz sentido para DESPESA; ignora se vier em RECEITA.
      let subTipoFinal = null;
      if (tipo === 'DESPESA' && (subTipo === 'VARIAVEL' || subTipo === 'FIXA')) {
        subTipoFinal = subTipo;
      }
      const cat = await prisma.categoriaFinanceira.create({
        data: { clienteId, nome: nome.trim(), tipo, subTipo: subTipoFinal, uso },
      });
      res.status(201).json(cat);
    } catch (error) {
      console.error('[criarCategoria]', error);
      res.status(500).json({ error: 'Erro ao criar categoria' });
    }
  }

  async editarCategoria(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { id } = req.params;
      const { nome, tipo, subTipo, uso } = req.body;
      const data = {};
      if (typeof nome === 'string' && nome.trim().length >= 2) data.nome = nome.trim();
      if (tipo === 'RECEITA' || tipo === 'DESPESA') data.tipo = tipo;
      if (['SERVICO', 'PRODUTO', 'CAIXA', 'DESPESA'].includes(uso)) data.uso = uso;
      // Permite explicitamente "limpar" o subTipo enviando null.
      if (subTipo === null) data.subTipo = null;
      else if (subTipo === 'VARIAVEL' || subTipo === 'FIXA') data.subTipo = subTipo;
      // Se mudou pra RECEITA, força subTipo a null pra manter coerência.
      if (data.tipo === 'RECEITA') data.subTipo = null;
      const cat = await prisma.categoriaFinanceira.update({ where: { id, clienteId }, data });
      res.json(cat);
    } catch (error) {
      console.error('[editarCategoria]', error);
      res.status(500).json({ error: 'Erro ao editar categoria' });
    }
  }

  async excluirCategoria(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { id } = req.params;
      await prisma.categoriaFinanceira.delete({ where: { id, clienteId } });
      res.json({ mensagem: 'Excluída' });
    } catch (error) {
      console.error('[excluirCategoria]', error);
      res.status(500).json({ error: 'Erro ao excluir categoria' });
    }
  }

  async saldoAtual(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const ultimo = await prisma.saldoHistorico.findFirst({ where: { clienteId }, orderBy: { data: 'desc' } });
      res.json({ saldo: ultimo?.valor || 0 });
    } catch (error) {
      console.error('[saldoAtual]', error);
      res.status(500).json({ error: 'Erro ao buscar saldo' });
    }
  }

  async ajustarSaldo(req, res) {
    try {
      const { clienteId, id: usuarioId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const usuarioNome = await obterNomeUsuario(usuarioId);
      const novo = await prisma.saldoHistorico.create({
        data: {
          clienteId,
          valor: parseFloat(req.body.valor),
          motivo: req.body.motivo,
          usuarioId: usuarioId || null,
          usuarioNome: usuarioNome || null,
        },
      });
      res.status(201).json(novo);
    } catch (error) {
      console.error('[ajustarSaldo]', error);
      res.status(500).json({ error: 'Erro ao ajustar saldo' });
    }
  }

  // Lista historico de mudancas de um lancamento (auditoria). Mais recente primeiro.
  async historicoLancamento(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const existente = await buscarLancamentoDoCliente(id, clienteId);
      if (!existente) return res.status(404).json({ error: 'Lancamento nao encontrado.' });

      const itens = await prisma.historicoLancamento.findMany({
        where: { lancamentoId: id },
        orderBy: { criadoEm: 'desc' },
      });
      res.json({ itens, total: itens.length });
    } catch (error) {
      console.error('[historicoLancamento]', error);
      res.status(500).json({ error: 'Erro ao carregar historico do lancamento' });
    }
  }

  // Lista historico de ajustes manuais (mais recente primeiro). Limite default
  // 50 — pra UI de auditoria mostrar quem mexeu no saldo e por que.
  async saldoHistorico(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const limite = Math.min(parseInt(req.query.limite, 10) || 50, 200);
      const itens = await prisma.saldoHistorico.findMany({
        where: { clienteId },
        orderBy: { data: 'desc' },
        take: limite,
      });
      res.json({ itens, total: itens.length });
    } catch (error) {
      console.error('[saldoHistorico]', error);
      res.status(500).json({ error: 'Erro ao listar historico de saldo' });
    }
  }

  async excluirLancamento(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      const existente = await buscarLancamentoDoCliente(id, clienteId);
      if (!existente) return res.status(404).json({ error: 'Lançamento não encontrado.' });
      // Trava de integridade: lancamento de venda NUNCA e excluido — vai cancelado pela venda.
      const bloqueio = bloquearSeVendaVinculada(existente);
      if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.erro });
      // Mes fechado: nao da pra apagar. Pra correcao, cancela ou faz lancamento compensatorio.
      if (ehMesFechadoImutavel(existente)) {
        return res.status(423).json({ error: MSG_BLOQUEIO_MES_FECHADO, codigo: 'MES_FECHADO' });
      }

      // Loga ANTES do delete (SET NULL no FK mantem a linha do historico).
      await logHistoricoLancamento({
        lancamentoId: id,
        acao: 'EXCLUIDO',
        alteracoes: {
          snapshot: {
            descricao: existente.descricao,
            valor: existente.valor,
            tipo: existente.tipo,
            status: existente.status,
            dataVencimento: existente.dataVencimento?.toISOString(),
          },
        },
        req,
      });
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
      const bloqueio = bloquearSeVendaVinculada(existente);
      if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.erro });
      // Mes fechado: nao cancela. Pra reverter, cria lancamento compensatorio.
      if (ehMesFechadoImutavel(existente)) {
        return res.status(423).json({ error: MSG_BLOQUEIO_MES_FECHADO, codigo: 'MES_FECHADO' });
      }

      const lancamento = await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: {
          status: 'CANCELADO',
          dataCancelamento: new Date(),
          motivoCancelamento: motivo
        }
      });
      await logHistoricoLancamento({
        lancamentoId: id,
        acao: 'CANCELADO',
        alteracoes: { motivo: motivo || null, statusAnterior: existente.status },
        req,
      });
      res.json(lancamento);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao cancelar lançamento' });
    }
  }

  async resumo(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

      const agregados = await prisma.lancamentoFinanceiro.groupBy({
        by: ['tipo', 'status'],
        where: {
          clienteId,
          dataVencimento: { gte: inicioMes, lte: fimMes }
        },
        _sum: { valor: true }
      });

      // Nomes ALINHADOS com o front: totalReceitas, totalDespesas, aReceber.
      // (antes era entradas/saidas/saldo — front ignorava e mostrava R$ 0,00).
      // entradas/saidas/saldo mantidos pra retrocompat com outros consumidores.
      const r = { totalReceitas: 0, totalDespesas: 0, aReceber: 0 };
      agregados.forEach(a => {
        const v = a._sum.valor || 0;
        if (a.status === 'PAGO') {
          if (a.tipo === 'RECEITA') r.totalReceitas += v;
          else r.totalDespesas += v;
        } else if (a.status === 'PENDENTE' && a.tipo === 'RECEITA') {
          r.aReceber += v;
        }
      });

      res.json({
        ...r,
        // Aliases legados (mesmo conteudo, nomes antigos).
        entradas: r.totalReceitas,
        saidas: r.totalDespesas,
        saldo: r.totalReceitas - r.totalDespesas,
      });
    } catch (error) {
      console.error('[resumo]', error);
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

      // Lancamentos de venda nao podem ser alterados em lote — filtra fora.
      const resultado = await prisma.lancamentoFinanceiro.updateMany({
        where: { id: { in: ids }, clienteId, vendaId: null },
        data: {
          status,
          dataPagamento: status === 'PAGO' ? new Date() : null
        }
      });

      const ignorados = ids.length - resultado.count;
      res.json({
        mensagem: ignorados > 0
          ? `${resultado.count} lancamento(s) atualizado(s). ${ignorados} ignorado(s) — sao de venda e so mudam pelo modulo Vendas.`
          : 'Status atualizado com sucesso.',
        alterados: resultado.count,
        ignorados,
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar em lote' });
    }
  }

  async excluirGrupo(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { idAgrupamento } = req.params;

      if (!idAgrupamento) return res.status(400).json({ error: 'ID de agrupamento inválido.' });

      // Filtra fora lancamentos de venda — eles nao podem ser excluidos por aqui.
      const resultado = await prisma.lancamentoFinanceiro.deleteMany({
        where: { idAgrupamento, clienteId, status: { not: 'PAGO' }, vendaId: null }
      });

      res.json({ mensagem: 'Parcelas não pagas excluídas.', excluidas: resultado.count });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir grupo' });
    }
  }

  async fluxoCaixa(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const hoje = new Date();
      const fim = new Date(); fim.setDate(hoje.getDate() + 30);
      const lancamentos = await prisma.lancamentoFinanceiro.findMany({ where: { clienteId, dataVencimento: { gte: hoje, lte: fim } } });
      res.json(lancamentos);
    } catch (error) {
      console.error('[fluxoCaixa]', error);
      res.status(500).json({ error: 'Erro ao buscar fluxo de caixa' });
    }
  }
}

module.exports = new FinanceiroController();
