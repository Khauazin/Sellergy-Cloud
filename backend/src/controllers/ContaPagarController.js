// =====================================================================
// CONTROLADOR DE CONTAS A PAGAR
// =====================================================================
// CRUD do catalogo de despesas recorrentes/pontuais. Cada ContaPagar e um
// "modelo" — o pagamento real cria um LancamentoFinanceiro DESPESA PAGO
// vinculado (ver pagar()).

const prisma = require('../prisma');
const { lockClienteAdvisory } = require('../utils/locks');

const PERIODICIDADES_VALIDAS = ['PONTUAL', 'MENSAL', 'ANUAL'];

class ContaPagarController {

  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const { ativa } = req.query;
      const where = { clienteId };
      if (ativa === 'true') where.ativa = true;
      else if (ativa === 'false') where.ativa = false;

      const contas = await prisma.contaPagar.findMany({
        where,
        include: {
          categoria: { select: { id: true, nome: true } },
          _count: { select: { pagamentos: true } },
        },
        orderBy: [{ ativa: 'desc' }, { nome: 'asc' }],
      });
      res.json(contas);
    } catch (e) {
      console.error('[contaPagar/listar]', e);
      res.status(500).json({ error: 'Erro ao listar contas a pagar.' });
    }
  }

  async criar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const { nome, valorPadrao, categoriaId, periodicidade, diaVencimento, mesVencimento, observacoes } = req.body;
      if (!nome || typeof nome !== 'string' || nome.trim().length < 2) {
        return res.status(422).json({ error: 'Nome obrigatório (mínimo 2 caracteres).' });
      }
      const valor = parseFloat(valorPadrao);
      if (!Number.isFinite(valor) || valor < 0) {
        return res.status(422).json({ error: 'Valor padrão inválido.' });
      }
      const per = PERIODICIDADES_VALIDAS.includes(periodicidade) ? periodicidade : 'MENSAL';
      const dia = Number.isInteger(diaVencimento) && diaVencimento >= 1 && diaVencimento <= 31 ? diaVencimento : null;
      const mes = (per === 'ANUAL' && Number.isInteger(mesVencimento) && mesVencimento >= 1 && mesVencimento <= 12)
        ? mesVencimento : null;

      // Valida categoria do tenant se informada.
      if (categoriaId) {
        const cat = await prisma.categoriaFinanceira.findFirst({
          where: { id: categoriaId, clienteId, tipo: 'DESPESA' },
        });
        if (!cat) return res.status(422).json({ error: 'Categoria inválida (deve ser DESPESA do tenant).' });
      }

      const conta = await prisma.contaPagar.create({
        data: {
          clienteId,
          nome: nome.trim(),
          valorPadrao: valor,
          categoriaId: categoriaId || null,
          periodicidade: per,
          diaVencimento: dia,
          mesVencimento: mes,
          observacoes: observacoes ? String(observacoes).trim() : null,
          ativa: true,
        },
        include: { categoria: { select: { id: true, nome: true } } },
      });
      res.status(201).json(conta);
    } catch (e) {
      console.error('[contaPagar/criar]', e);
      res.status(500).json({ error: 'Erro ao criar conta a pagar.' });
    }
  }

  async editar(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { id } = req.params;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const existente = await prisma.contaPagar.findFirst({ where: { id, clienteId } });
      if (!existente) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });

      const { nome, valorPadrao, categoriaId, periodicidade, diaVencimento, mesVencimento, observacoes, ativa } = req.body;
      const data = {};
      if (nome !== undefined) {
        if (typeof nome !== 'string' || nome.trim().length < 2) {
          return res.status(422).json({ error: 'Nome inválido.' });
        }
        data.nome = nome.trim();
      }
      if (valorPadrao !== undefined) {
        const v = parseFloat(valorPadrao);
        if (!Number.isFinite(v) || v < 0) return res.status(422).json({ error: 'Valor inválido.' });
        data.valorPadrao = v;
      }
      if (categoriaId !== undefined) {
        if (categoriaId) {
          const cat = await prisma.categoriaFinanceira.findFirst({
            where: { id: categoriaId, clienteId, tipo: 'DESPESA' },
          });
          if (!cat) return res.status(422).json({ error: 'Categoria inválida.' });
        }
        data.categoriaId = categoriaId || null;
      }
      if (periodicidade !== undefined && PERIODICIDADES_VALIDAS.includes(periodicidade)) {
        data.periodicidade = periodicidade;
      }
      if (diaVencimento !== undefined) {
        data.diaVencimento = (Number.isInteger(diaVencimento) && diaVencimento >= 1 && diaVencimento <= 31) ? diaVencimento : null;
      }
      if (mesVencimento !== undefined) {
        data.mesVencimento = (Number.isInteger(mesVencimento) && mesVencimento >= 1 && mesVencimento <= 12) ? mesVencimento : null;
      }
      if (observacoes !== undefined) data.observacoes = observacoes ? String(observacoes).trim() : null;
      if (ativa !== undefined) data.ativa = !!ativa;

      const conta = await prisma.contaPagar.update({
        where: { id },
        data,
        include: { categoria: { select: { id: true, nome: true } } },
      });
      res.json(conta);
    } catch (e) {
      console.error('[contaPagar/editar]', e);
      res.status(500).json({ error: 'Erro ao editar conta a pagar.' });
    }
  }

  // DELETE: so permite se NUNCA foi paga. Senao, o usuario deve usar ativa=false
  // (preserva historico de pagamentos via LancamentoFinanceiro.contaPagarId).
  async excluir(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { id } = req.params;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const conta = await prisma.contaPagar.findFirst({
        where: { id, clienteId },
        include: { _count: { select: { pagamentos: true } } },
      });
      if (!conta) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });
      if (conta._count.pagamentos > 0) {
        return res.status(409).json({
          error: 'Não dá pra excluir uma conta com pagamentos registrados. Desative em vez de excluir.',
          codigo: 'TEM_PAGAMENTOS',
        });
      }
      await prisma.contaPagar.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      console.error('[contaPagar/excluir]', e);
      res.status(500).json({ error: 'Erro ao excluir conta a pagar.' });
    }
  }

  // POST /contas-pagar/:id/pagar — { valor, sessaoCaixaId?, motivo?, dataVencimento? }
  //
  // Marca a conta como paga: cria 1 LancamentoFinanceiro DESPESA PAGO vinculado
  // a esta ContaPagar. Se sessaoCaixaId vier OU houver sessao aberta, cria
  // TAMBEM 1 SaldoHistorico SANGRIA (sai do caixa fisico).
  //
  // Tudo numa transacao + advisory lock pelo clienteId (evita race com cron
  // do caixa fechando sessao no meio).
  async pagar(req, res) {
    try {
      const { clienteId, id: usuarioId } = req.usuario;
      const { id } = req.params;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const valor = parseFloat(req.body.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return res.status(422).json({ error: 'Valor inválido (> 0).' });
      }
      const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
      const dataVencimento = req.body.dataVencimento ? new Date(req.body.dataVencimento) : new Date();
      // Flag explicita: se false, paga apenas como lancamento (nao tira do caixa).
      // Util quando o usuario pagou direto do banco (boleto, PIX) sem mexer no caixa.
      const tirarDoCaixa = req.body.tirarDoCaixa !== false;

      const conta = await prisma.contaPagar.findFirst({
        where: { id, clienteId },
        include: { categoria: true },
      });
      if (!conta) return res.status(404).json({ error: 'Conta a pagar não encontrada.' });

      const usuarioNome = usuarioId ? (await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { nome: true },
      }))?.nome : null;

      const resultado = await prisma.$transaction(async (tx) => {
        await lockClienteAdvisory(tx, clienteId);

        // Se tirarDoCaixa, busca sessao aberta. Se nao tem, erro 409.
        let sessao = null;
        if (tirarDoCaixa) {
          sessao = await tx.sessaoCaixa.findFirst({
            where: { clienteId, status: 'ABERTA' },
            orderBy: { abertaEm: 'desc' },
          });
          if (!sessao) {
            throw Object.assign(new Error('Abra o caixa antes de pagar pela retirada de dinheiro.'), {
              status: 409,
              codigo: 'CAIXA_FECHADO',
            });
          }
        }

        const descricao = `${conta.nome}${motivo ? ` — ${motivo}` : ''}`;

        // 1. Lancamento financeiro DESPESA PAGO vinculado a conta
        const lanc = await tx.lancamentoFinanceiro.create({
          data: {
            clienteId,
            categoriaId: conta.categoriaId,
            contaPagarId: conta.id,
            descricao,
            valor,
            tipo: 'DESPESA',
            status: 'PAGO',
            dataVencimento,
            dataPagamento: new Date(),
            sessaoCaixaId: sessao?.id || null,
          },
        });

        // 2. Se tirar do caixa, cria SaldoHistorico SANGRIA vinculada
        let saldoHist = null;
        if (sessao) {
          saldoHist = await tx.saldoHistorico.create({
            data: {
              clienteId,
              sessaoCaixaId: sessao.id,
              valor,
              tipo: 'SANGRIA',
              motivo: `Pagamento: ${conta.nome}${motivo ? ` (${motivo})` : ''}`,
              usuarioId: usuarioId || null,
              usuarioNome: usuarioNome || null,
            },
          });
        }

        return { lancamento: lanc, saldoHistorico: saldoHist };
      });

      res.status(201).json(resultado);
    } catch (e) {
      const status = e?.status || 500;
      const payload = { error: e?.message || 'Erro ao pagar conta.' };
      if (e?.codigo) payload.codigo = e.codigo;
      console.error('[contaPagar/pagar]', e?.message);
      res.status(status).json(payload);
    }
  }
}

module.exports = new ContaPagarController();
