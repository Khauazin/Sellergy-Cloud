const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('BOTS'));

// Limites de seguranca para o canvas. Bloqueiam payloads abusivos
// antes de chegarem ao banco e protegem contra DoS por JSON gigante.
const LIMITES = Object.freeze({
  MAX_NOS_POR_FLUXO: 200,
  MAX_CONEXOES_POR_FLUXO: 500,
  MAX_BYTES_DADOS_NO: 100_000,
  MAX_TAM_NOME_FLUXO: 200,
  MAX_TAM_PALAVRA_CHAVE: 100,
});

const TIPOS_NO_VALIDOS = new Set([
  // Legados (bot atual de mensagem)
  'MESSAGE', 'QUESTION', 'CONDITION', 'DELAY', 'HTTP_REQUEST', 'UPDATE_LEAD',
  // Engine MVP — Fase 1
  'MANUAL', 'IF', 'SET', 'CODE',
  // Triggers da Fase 2
  'WEBHOOK', 'SCHEDULE',
  // IA — Fase 3
  'AI_AGENT',
  // Canais — envio direto pelo canal externo (WhatsApp/Telegram)
  'ENVIAR_MENSAGEM',
]);

const TIPOS_GATILHO_VALIDOS = new Set(['KEYWORD', 'DEFAULT', 'ALWAYS']);

// ==========================================
// Helpers de tenant e validacao
// ==========================================

async function botPertenceAoTenant(botId, usuario) {
  if (typeof botId !== 'string' || !botId) return false;
  const where = ehAdmin(usuario) ? { id: botId } : { id: botId, clienteId: usuario.clienteId };
  const bot = await prisma.bot.findFirst({ where, select: { id: true } });
  return !!bot;
}

async function buscarFluxoDoTenant(fluxoId, usuario) {
  if (typeof fluxoId !== 'string' || !fluxoId) return null;
  const where = ehAdmin(usuario)
    ? { id: fluxoId }
    : { id: fluxoId, bot: { clienteId: usuario.clienteId } };
  return prisma.fluxo.findFirst({ where, select: { id: true, botId: true } });
}

function ehStringNaoVazia(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function ehNumeroFinito(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function tamanhoBytesJson(valor) {
  try {
    return Buffer.byteLength(JSON.stringify(valor ?? {}), 'utf8');
  } catch {
    return Infinity;
  }
}

function validarMetadadosFluxo(corpo, { obrigarNome }) {
  const { nome, ativo, tipoGatilho, palavraChaveGatilho } = corpo || {};
  const dados = {};

  if (obrigarNome || nome !== undefined) {
    if (!ehStringNaoVazia(nome)) return { erro: 'Campo "nome" e obrigatorio.' };
    if (nome.length > LIMITES.MAX_TAM_NOME_FLUXO) {
      return { erro: `Campo "nome" excede ${LIMITES.MAX_TAM_NOME_FLUXO} caracteres.` };
    }
    dados.nome = nome.trim();
  }

  if (ativo !== undefined) {
    if (typeof ativo !== 'boolean') return { erro: 'Campo "ativo" deve ser booleano.' };
    dados.ativo = ativo;
  }

  if (tipoGatilho !== undefined) {
    if (!TIPOS_GATILHO_VALIDOS.has(tipoGatilho)) {
      return { erro: `Campo "tipoGatilho" invalido. Use: ${[...TIPOS_GATILHO_VALIDOS].join(', ')}.` };
    }
    dados.tipoGatilho = tipoGatilho;
  }

  if (palavraChaveGatilho !== undefined) {
    if (palavraChaveGatilho !== null && typeof palavraChaveGatilho !== 'string') {
      return { erro: 'Campo "palavraChaveGatilho" deve ser texto ou nulo.' };
    }
    if (typeof palavraChaveGatilho === 'string' && palavraChaveGatilho.length > LIMITES.MAX_TAM_PALAVRA_CHAVE) {
      return { erro: `Campo "palavraChaveGatilho" excede ${LIMITES.MAX_TAM_PALAVRA_CHAVE} caracteres.` };
    }
    dados.palavraChaveGatilho = palavraChaveGatilho || null;
  }

  return { dados };
}

function validarCanvas({ nos, conexoes }) {
  if (!Array.isArray(nos)) return { erro: 'Campo "nos" deve ser uma lista.' };
  if (!Array.isArray(conexoes)) return { erro: 'Campo "conexoes" deve ser uma lista.' };

  if (nos.length > LIMITES.MAX_NOS_POR_FLUXO) {
    return { erro: `Limite de ${LIMITES.MAX_NOS_POR_FLUXO} nos por fluxo excedido.` };
  }
  if (conexoes.length > LIMITES.MAX_CONEXOES_POR_FLUXO) {
    return { erro: `Limite de ${LIMITES.MAX_CONEXOES_POR_FLUXO} conexoes por fluxo excedido.` };
  }

  const idsNos = new Set();
  for (const no of nos) {
    if (!no || !ehStringNaoVazia(no.id)) return { erro: 'Cada no precisa de um "id" texto.' };
    if (idsNos.has(no.id)) return { erro: `Id de no duplicado: ${no.id}.` };
    idsNos.add(no.id);

    if (!TIPOS_NO_VALIDOS.has(no.tipo)) {
      return { erro: `Tipo de no invalido em "${no.id}": ${no.tipo}.` };
    }
    if (!ehNumeroFinito(no.posicaoX) || !ehNumeroFinito(no.posicaoY)) {
      return { erro: `Posicao invalida no no "${no.id}".` };
    }
    if (no.dados !== undefined && no.dados !== null && typeof no.dados !== 'object') {
      return { erro: `Campo "dados" do no "${no.id}" deve ser objeto JSON.` };
    }
    if (tamanhoBytesJson(no.dados) > LIMITES.MAX_BYTES_DADOS_NO) {
      return { erro: `Dados do no "${no.id}" excedem ${LIMITES.MAX_BYTES_DADOS_NO} bytes.` };
    }
  }

  const idsConexoes = new Set();
  for (const con of conexoes) {
    if (!con || !ehStringNaoVazia(con.id)) return { erro: 'Cada conexao precisa de um "id" texto.' };
    if (idsConexoes.has(con.id)) return { erro: `Id de conexao duplicado: ${con.id}.` };
    idsConexoes.add(con.id);

    if (!ehStringNaoVazia(con.noOrigemId) || !ehStringNaoVazia(con.noDestinoId)) {
      return { erro: `Conexao "${con.id}" precisa de "noOrigemId" e "noDestinoId".` };
    }
    if (!idsNos.has(con.noOrigemId)) {
      return { erro: `Conexao "${con.id}" referencia no de origem inexistente: ${con.noOrigemId}.` };
    }
    if (!idsNos.has(con.noDestinoId)) {
      return { erro: `Conexao "${con.id}" referencia no de destino inexistente: ${con.noDestinoId}.` };
    }
    if (con.pontoOrigem !== undefined && con.pontoOrigem !== null && typeof con.pontoOrigem !== 'string') {
      return { erro: `Campo "pontoOrigem" da conexao "${con.id}" deve ser texto ou nulo.` };
    }
  }

  return { ok: true };
}

// ==========================================
// FLUXOS
// ==========================================

roteador.get('/fluxos/:botId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { botId } = req.params;

    if (!(await botPertenceAoTenant(botId, req.usuario))) {
      return res.status(404).json({ erro: 'Bot nao encontrado.' });
    }

    const fluxos = await prisma.fluxo.findMany({
      where: { botId },
      include: {
        _count: { select: { nos: true, conexoes: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });

    res.json(fluxos);
  } catch (erro) {
    console.error('[builder/listar-fluxos]', erro);
    res.status(500).json({ erro: 'Erro ao buscar fluxos.' });
  }
});

roteador.post('/fluxos', requerPermissao('BOTS', 'criar'), async (req, res) => {
  try {
    const { botId } = req.body || {};

    if (!ehStringNaoVazia(botId)) {
      return res.status(400).json({ erro: 'Campo "botId" e obrigatorio.' });
    }
    if (!(await botPertenceAoTenant(botId, req.usuario))) {
      return res.status(403).json({ erro: 'Bot nao pertence a este tenant.' });
    }

    const valid = validarMetadadosFluxo(req.body, { obrigarNome: true });
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    const fluxo = await prisma.fluxo.create({
      data: { botId, ...valid.dados },
    });
    res.status(201).json(fluxo);
  } catch (erro) {
    console.error('[builder/criar-fluxo]', erro);
    res.status(500).json({ erro: 'Erro ao criar fluxo.' });
  }
});

roteador.put('/fluxos/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await buscarFluxoDoTenant(id, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const valid = validarMetadadosFluxo(req.body, { obrigarNome: false });
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    if (Object.keys(valid.dados).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }

    const fluxo = await prisma.fluxo.update({
      where: { id },
      data: valid.dados,
    });
    res.json(fluxo);
  } catch (erro) {
    console.error('[builder/atualizar-fluxo]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar fluxo.' });
  }
});

roteador.delete('/fluxos/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await buscarFluxoDoTenant(id, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    await prisma.fluxo.delete({ where: { id } });
    res.json({ mensagem: 'Fluxo excluido com sucesso.' });
  } catch (erro) {
    console.error('[builder/excluir-fluxo]', erro);
    res.status(500).json({ erro: 'Erro ao excluir fluxo.' });
  }
});

// ==========================================
// CANVAS (nos + conexoes)
// ==========================================

roteador.get('/fluxos/:fluxoId/canvas', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;

    if (!(await buscarFluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const [nos, conexoes] = await Promise.all([
      prisma.no.findMany({ where: { fluxoId }, orderBy: { criadoEm: 'asc' } }),
      prisma.conexao.findMany({ where: { fluxoId }, orderBy: { criadoEm: 'asc' } }),
    ]);

    res.json({ nos, conexoes });
  } catch (erro) {
    console.error('[builder/obter-canvas]', erro);
    res.status(500).json({ erro: 'Erro ao buscar canvas.' });
  }
});

// PUT (idempotente): substitui o canvas por completo.
roteador.put('/fluxos/:fluxoId/canvas', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;
    const { nos, conexoes } = req.body || {};

    if (!(await buscarFluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const valid = validarCanvas({ nos, conexoes });
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    await prisma.$transaction(async (tx) => {
      await tx.conexao.deleteMany({ where: { fluxoId } });
      await tx.no.deleteMany({ where: { fluxoId } });

      if (nos.length > 0) {
        await tx.no.createMany({
          data: nos.map((n) => ({
            id: n.id,
            fluxoId,
            tipo: n.tipo,
            posicaoX: n.posicaoX,
            posicaoY: n.posicaoY,
            dados: n.dados ?? {},
          })),
        });
      }

      if (conexoes.length > 0) {
        await tx.conexao.createMany({
          data: conexoes.map((c) => ({
            id: c.id,
            fluxoId,
            noOrigemId: c.noOrigemId,
            noDestinoId: c.noDestinoId,
            pontoOrigem: c.pontoOrigem || null,
          })),
        });
      }
    });

    res.json({ mensagem: 'Canvas salvo com sucesso.' });
  } catch (erro) {
    console.error('[builder/salvar-canvas]', erro);
    res.status(500).json({ erro: 'Erro ao salvar canvas.' });
  }
});

module.exports = roteador;
