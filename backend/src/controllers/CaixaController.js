const prisma = require('../prisma');
const { lockClienteAdvisory } = require('../utils/locks');

// =====================================================================
// CONTROLADOR DE CAIXA — SESSAO ABERTA/FECHADA
// =====================================================================
// Conceito: 1 sessao aberta por tenant por vez. Manual quando o usuario
// abre com fundo de caixa; AUTO_BOT quando o cron 00:00 cria, ou quando
// chega venda do bot sem caixa aberto.
//
// Saldo esperado = fundoCaixa
//                + soma(vendas RECEITA da sessao)
//                + suprimentos da sessao
//                - sangrias da sessao
//
// Diferenca = saldoFinalReal (informado pelo usuario) - saldoFinalEsperado
//   > 0: sobra (entrada nao registrada)
//   < 0: falta (saida/divergencia)
//   = 0: bate

// Busca a sessao aberta atual do tenant (null se nao tem).
async function buscarSessaoAberta(clienteId, tx = prisma) {
  return tx.sessaoCaixa.findFirst({
    where: { clienteId, status: 'ABERTA' },
    orderBy: { abertaEm: 'desc' },
  });
}

// Calcula o saldo esperado de uma sessao olhando vendas (RECEITA PAGO) +
// movimentacoes de saldo (suprimento/sangria) vinculadas a ela.
async function calcularSaldoEsperado(sessaoId, tx = prisma) {
  const sessao = await tx.sessaoCaixa.findUnique({
    where: { id: sessaoId },
    select: { fundoCaixa: true },
  });
  if (!sessao) return 0;

  // Soma vendas RECEITA PAGO vinculadas a sessao (via lancamentos financeiros).
  // Pega tudo do tipo RECEITA com status PAGO e sessaoCaixaId = X.
  const lancAgreg = await tx.lancamentoFinanceiro.aggregate({
    where: { sessaoCaixaId: sessaoId, tipo: 'RECEITA', status: 'PAGO' },
    _sum: { valor: true },
  });
  const totalVendas = lancAgreg._sum.valor || 0;

  // Soma suprimentos (entram no caixa) e sangrias (saem).
  const movs = await tx.saldoHistorico.findMany({
    where: { sessaoCaixaId: sessaoId, tipo: { in: ['SUPRIMENTO', 'SANGRIA'] } },
    select: { valor: true, tipo: true },
  });
  let totalSuprimentos = 0;
  let totalSangrias = 0;
  for (const m of movs) {
    if (m.tipo === 'SUPRIMENTO') totalSuprimentos += m.valor;
    else if (m.tipo === 'SANGRIA') totalSangrias += m.valor;
  }

  return sessao.fundoCaixa + totalVendas + totalSuprimentos - totalSangrias;
}

// Helper: snapshot do nome do usuario logado (JWT so traz id).
const cacheNomeUsuario = new Map();
async function obterNomeUsuario(usuarioId) {
  if (!usuarioId) return null;
  if (cacheNomeUsuario.has(usuarioId)) return cacheNomeUsuario.get(usuarioId);
  try {
    const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true } });
    const nome = u?.nome || null;
    cacheNomeUsuario.set(usuarioId, nome);
    if (cacheNomeUsuario.size > 200) {
      cacheNomeUsuario.delete(cacheNomeUsuario.keys().next().value);
    }
    return nome;
  } catch {
    return null;
  }
}

class CaixaController {
  // GET /caixa/atual — sessao aberta + saldo esperado em tempo real.
  async atual(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const sessao = await buscarSessaoAberta(clienteId);
      if (!sessao) return res.json({ sessao: null });

      const saldoEsperado = await calcularSaldoEsperado(sessao.id);
      res.json({
        sessao: { ...sessao, saldoEsperado },
      });
    } catch (e) {
      console.error('[caixa/atual]', e);
      res.status(500).json({ error: 'Erro ao buscar caixa atual' });
    }
  }

  // POST /caixa/abrir — { fundoCaixa, observacao }.
  // Se ja tem sessao MANUAL aberta, rejeita. Se tem AUTO_BOT aberta, fecha
  // ela primeiro (transferindo saldo final pra fundo da nova).
  async abrir(req, res) {
    try {
      const { clienteId, id: usuarioId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const fundoCaixa = parseFloat(req.body.fundoCaixa);
      if (Number.isNaN(fundoCaixa) || fundoCaixa < 0) {
        return res.status(422).json({ error: 'Fundo de caixa inválido (precisa ser ≥ 0).' });
      }
      const observacao = typeof req.body.observacao === 'string' ? req.body.observacao.trim() : null;

      const usuarioNome = await obterNomeUsuario(usuarioId);

      const resultado = await prisma.$transaction(async (tx) => {
        // Lock advisory: serializa com cron 00:01 e venda do bot. Garante
        // que nao ficam 2 sessoes ABERTA simultaneas.
        await lockClienteAdvisory(tx, clienteId);
        // Se ja tem sessao aberta, decide: MANUAL -> rejeita; AUTO -> fecha.
        const sessaoExistente = await buscarSessaoAberta(clienteId, tx);
        if (sessaoExistente) {
          if (sessaoExistente.origem === 'MANUAL') {
            throw Object.assign(new Error('Já existe um caixa MANUAL aberto. Feche o atual antes de abrir outro.'), { status: 409 });
          }
          // AUTO_BOT: fecha automaticamente. Saldo final esperado vira o
          // que estiver calculado; saldoFinalReal = esperado (sem contagem).
          const esperadoAuto = await calcularSaldoEsperado(sessaoExistente.id, tx);
          await tx.sessaoCaixa.update({
            where: { id: sessaoExistente.id },
            data: {
              status: 'FECHADA',
              fechadaEm: new Date(),
              saldoFinalEsperado: esperadoAuto,
              saldoFinalReal: esperadoAuto,
              diferenca: 0,
              observacaoFechamento: 'Fechada automaticamente ao abrir caixa MANUAL.',
            },
          });
        }

        const nova = await tx.sessaoCaixa.create({
          data: {
            clienteId,
            fundoCaixa,
            observacaoAbertura: observacao,
            usuarioAbriuId: usuarioId || null,
            usuarioAbriuNome: usuarioNome || null,
            status: 'ABERTA',
            origem: 'MANUAL',
          },
        });
        return nova;
      });

      res.status(201).json({ sessao: resultado });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[caixa/abrir]', e?.message);
      res.status(status).json({ error: e?.message || 'Erro ao abrir caixa' });
    }
  }

  // POST /caixa/fechar — { saldoFinalReal, observacao }.
  // Calcula diferenca e fecha. Saldo real obrigatorio.
  async fechar(req, res) {
    try {
      const { clienteId, id: usuarioId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const saldoFinalReal = parseFloat(req.body.saldoFinalReal);
      if (Number.isNaN(saldoFinalReal)) {
        return res.status(422).json({ error: 'Informe o saldo real contado no caixa.' });
      }
      const observacao = typeof req.body.observacao === 'string' ? req.body.observacao.trim() : null;
      const usuarioNome = await obterNomeUsuario(usuarioId);

      const atualizada = await prisma.$transaction(async (tx) => {
        // Lock serializa com cron 00:01 (que tambem fecha AUTO_BOT) e com
        // operacoes do bot. Sem isso, dois fechamentos simultaneos podem
        // sobrescrever os dados um do outro.
        await lockClienteAdvisory(tx, clienteId);

        // Re-busca DENTRO da TX — sessao pode ter sido fechada pelo cron entre
        // o request chegar e o lock liberar. Sem re-buscar, atualizariamos uma
        // sessao ja FECHADA e sobrescreveriamos os dados do cron.
        const sessao = await buscarSessaoAberta(clienteId, tx);
        if (!sessao) {
          throw Object.assign(new Error('Não tem caixa aberto pra fechar (pode ter sido fechado automaticamente).'), { status: 404 });
        }

        const saldoEsperado = await calcularSaldoEsperado(sessao.id, tx);
        const diferenca = Number((saldoFinalReal - saldoEsperado).toFixed(2));

        return tx.sessaoCaixa.update({
          where: { id: sessao.id },
          data: {
            status: 'FECHADA',
            fechadaEm: new Date(),
            saldoFinalEsperado: saldoEsperado,
            saldoFinalReal,
            diferenca,
            observacaoFechamento: observacao,
            usuarioFechouId: usuarioId || null,
            usuarioFechouNome: usuarioNome || null,
          },
        });
      });

      res.json({ sessao: atualizada });
    } catch (e) {
      const status = e?.status || 500;
      console.error('[caixa/fechar]', e?.message);
      res.status(status).json({ error: e?.message || 'Erro ao fechar caixa' });
    }
  }

  // POST /caixa/sangria — { valor, motivo }. Saida de dinheiro do caixa.
  async sangria(req, res) {
    return this._movimentacao(req, res, 'SANGRIA');
  }

  // POST /caixa/suprimento — { valor, motivo }. Entrada manual no caixa.
  async suprimento(req, res) {
    return this._movimentacao(req, res, 'SUPRIMENTO');
  }

  async _movimentacao(req, res, tipo) {
    try {
      const { clienteId, id: usuarioId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const valor = parseFloat(req.body.valor);
      if (Number.isNaN(valor) || valor <= 0) {
        return res.status(422).json({ error: 'Valor inválido (precisa ser > 0).' });
      }
      const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
      if (motivo.length < 3) {
        return res.status(422).json({ error: 'Informe o motivo (mínimo 3 caracteres).', campos: ['motivo'] });
      }
      const usuarioNome = await obterNomeUsuario(usuarioId);

      const movimentacao = await prisma.$transaction(async (tx) => {
        // Lock + re-busca: garante que a sessao continua ABERTA no momento de
        // criar a movimentacao. Sem isso, cron pode fechar a sessao entre o
        // findFirst e o create, deixando a movimentacao orfa (vinculada a sessao
        // FECHADA, cujo saldo ja foi congelado sem considerar este lancamento).
        await lockClienteAdvisory(tx, clienteId);

        const sessao = await buscarSessaoAberta(clienteId, tx);
        if (!sessao) {
          throw Object.assign(new Error('Abra o caixa antes de lançar sangria/suprimento.'), {
            status: 409,
            codigo: 'CAIXA_FECHADO',
          });
        }

        return tx.saldoHistorico.create({
          data: {
            clienteId,
            sessaoCaixaId: sessao.id,
            valor,
            tipo,
            motivo,
            usuarioId: usuarioId || null,
            usuarioNome: usuarioNome || null,
          },
        });
      });

      res.status(201).json({ movimentacao });
    } catch (e) {
      const status = e?.status || 500;
      const payload = { error: e?.message || `Erro ao registrar ${tipo.toLowerCase()}` };
      if (e?.codigo) payload.codigo = e.codigo;
      console.error(`[caixa/${tipo.toLowerCase()}]`, e?.message);
      res.status(status).json(payload);
    }
  }

  // GET /caixa/sessoes — histórico paginado das sessões já fechadas.
  // Sessão aberta atual vem em /caixa/atual.
  async listarSessoes(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });
      const limite = Math.min(parseInt(req.query.limite, 10) || 30, 100);

      const sessoes = await prisma.sessaoCaixa.findMany({
        where: { clienteId, status: 'FECHADA' },
        orderBy: { fechadaEm: 'desc' },
        take: limite,
      });
      res.json({ sessoes, total: sessoes.length });
    } catch (e) {
      console.error('[caixa/sessoes]', e);
      res.status(500).json({ error: 'Erro ao listar sessões' });
    }
  }

  // GET /caixa/sessoes/:id — detalhe de uma sessao (vendas + mov + lancamentos).
  async detalheSessao(req, res) {
    try {
      const { clienteId } = req.usuario;
      const { id } = req.params;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const sessao = await prisma.sessaoCaixa.findFirst({
        where: { id, clienteId },
        include: {
          vendas: { orderBy: { criadoEm: 'desc' } },
          movimentacoesSaldo: { orderBy: { data: 'desc' } },
          lancamentos: { orderBy: { criadoEm: 'desc' } },
        },
      });
      if (!sessao) return res.status(404).json({ error: 'Sessão não encontrada.' });
      res.json({ sessao });
    } catch (e) {
      console.error('[caixa/sessao-detalhe]', e);
      res.status(500).json({ error: 'Erro ao buscar sessão' });
    }
  }
}

// Exports nominais pra outros controllers (Vendas) usarem.
module.exports = new CaixaController();
module.exports.helpers = {
  buscarSessaoAberta,
  calcularSaldoEsperado,
};
