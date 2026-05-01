const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { criarExecucaoPendente } = require('../engine');
const { enfileirarExecucao } = require('../filas');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('BOTS'));

const TAMANHO_MAX_GATILHO_BYTES = 50_000;

const PAGINA_LIMITE_MAX = 100;
const PAGINA_LIMITE_PADRAO = 20;

function filtroTenant(usuario) {
  return ehAdmin(usuario) ? {} : { fluxo: { bot: { clienteId: usuario.clienteId } } };
}

async function fluxoDoTenant(fluxoId, usuario) {
  if (typeof fluxoId !== 'string' || !fluxoId) return null;
  const where = ehAdmin(usuario)
    ? { id: fluxoId }
    : { id: fluxoId, bot: { clienteId: usuario.clienteId } };
  return prisma.fluxo.findFirst({ where, select: { id: true } });
}

function parseLimite(valor) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return PAGINA_LIMITE_PADRAO;
  return Math.min(n, PAGINA_LIMITE_MAX);
}

// GET /execucoes/fluxo/:fluxoId?limite=20&cursor=<id>
roteador.get('/fluxo/:fluxoId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;

    if (!(await fluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const limite = parseLimite(req.query.limite);
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;

    const execucoes = await prisma.execucao.findMany({
      where: { fluxoId },
      orderBy: { iniciadaEm: 'desc' },
      take: limite + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        status: true,
        modo: true,
        iniciadaEm: true,
        finalizadaEm: true,
        duracaoMs: true,
        erro: true,
        iniciadaPor: { select: { id: true, nome: true, email: true } },
      },
    });

    const proximaPagina = execucoes.length > limite ? execucoes.pop().id : null;
    res.json({ itens: execucoes, proximoCursor: proximaPagina });
  } catch (erro) {
    console.error('[execucoes/listar]', erro);
    res.status(500).json({ erro: 'Erro ao buscar execucoes.' });
  }
});

// GET /execucoes/:id  -> detalhes com nos executados.
roteador.get('/:id', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string' || !id) {
      return res.status(400).json({ erro: 'Id da execucao invalido.' });
    }

    const execucao = await prisma.execucao.findFirst({
      where: { id, ...filtroTenant(req.usuario) },
      include: {
        iniciadaPor: { select: { id: true, nome: true, email: true } },
        nos: { orderBy: { iniciadoEm: 'asc' } },
      },
    });

    if (!execucao) {
      return res.status(404).json({ erro: 'Execucao nao encontrada.' });
    }

    res.json(execucao);
  } catch (erro) {
    console.error('[execucoes/detalhar]', erro);
    res.status(500).json({ erro: 'Erro ao buscar execucao.' });
  }
});

// POST /execucoes/fluxo/:fluxoId  -> dispara execucao manual sincrona.
roteador.post('/fluxo/:fluxoId', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;

    if (!(await fluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const dadosGatilho = req.body?.dadosGatilho ?? null;
    if (dadosGatilho !== null) {
      if (typeof dadosGatilho !== 'object') {
        return res.status(400).json({ erro: 'Campo "dadosGatilho" deve ser objeto JSON.' });
      }
      const tamanho = Buffer.byteLength(JSON.stringify(dadosGatilho), 'utf8');
      if (tamanho > TAMANHO_MAX_GATILHO_BYTES) {
        return res
          .status(400)
          .json({ erro: `dadosGatilho excede ${TAMANHO_MAX_GATILHO_BYTES} bytes.` });
      }
    }

    const execucao = await criarExecucaoPendente({
      fluxoId,
      usuarioId: req.usuario.id,
      dadosGatilho,
      modo: 'MANUAL',
    });

    try {
      await enfileirarExecucao({ execucaoId: execucao.id });
    } catch (erro) {
      // Falha de Redis: marca a Execucao como ERRO para nao deixar em PENDENTE eterno.
      console.error('[execucoes/enfileirar]', erro);
      await prisma.execucao.update({
        where: { id: execucao.id },
        data: {
          status: 'ERRO',
          finalizadaEm: new Date(),
          erro: 'Falha ao enfileirar execucao (Redis indisponivel?).',
        },
      });
      return res.status(503).json({ erro: 'Servico de filas indisponivel.' });
    }

    res.status(202).json({
      execucaoId: execucao.id,
      status: execucao.status,
    });
  } catch (erro) {
    console.error('[execucoes/iniciar]', erro);
    res.status(500).json({ erro: erro.message || 'Erro ao iniciar execucao.' });
  }
});

module.exports = roteador;
