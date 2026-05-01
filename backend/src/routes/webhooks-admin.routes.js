// CRUD de webhooks autenticados (multi-tenant). A rota publica que recebe
// chamadas externas vive em `webhooks-publico.routes.js`.
const crypto = require('crypto');
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

const TAM_DESCRICAO_MAX = 200;

function gerarSegredo() {
  // 32 bytes em hex = 64 chars. Forte o suficiente para HMAC SHA-256.
  return crypto.randomBytes(32).toString('hex');
}

async function fluxoDoTenant(fluxoId, usuario) {
  const where = ehAdmin(usuario)
    ? { id: fluxoId }
    : { id: fluxoId, bot: { clienteId: usuario.clienteId } };
  return prisma.fluxo.findFirst({ where, select: { id: true } });
}

async function webhookDoTenant(webhookId, usuario) {
  const where = ehAdmin(usuario)
    ? { id: webhookId }
    : { id: webhookId, fluxo: { bot: { clienteId: usuario.clienteId } } };
  return prisma.webhook.findFirst({ where });
}

function validarDescricao(descricao) {
  if (descricao === undefined || descricao === null) return null;
  if (typeof descricao !== 'string') return undefined;
  if (descricao.length > TAM_DESCRICAO_MAX) return undefined;
  return descricao.trim() || null;
}

// GET /webhooks/fluxo/:fluxoId  -> lista webhooks do fluxo
roteador.get('/fluxo/:fluxoId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;
    if (!(await fluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }
    const webhooks = await prisma.webhook.findMany({
      where: { fluxoId },
      orderBy: { criadoEm: 'asc' },
    });
    res.json(webhooks);
  } catch (erro) {
    console.error('[webhooks/listar]', erro);
    res.status(500).json({ erro: 'Erro ao buscar webhooks.' });
  }
});

// GET /webhooks/no/:noId -> webhook do nó (404 se nao existe)
roteador.get('/no/:noId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { noId } = req.params;
    const where = ehAdmin(req.usuario)
      ? { noId }
      : { noId, fluxo: { bot: { clienteId: req.usuario.clienteId } } };
    const webhook = await prisma.webhook.findFirst({ where });
    if (!webhook) return res.status(404).json({ erro: 'Webhook nao encontrado.' });
    res.json(webhook);
  } catch (erro) {
    console.error('[webhooks/por-no]', erro);
    res.status(500).json({ erro: 'Erro ao buscar webhook.' });
  }
});

// POST /webhooks/fluxo/:fluxoId  body: { noId, descricao?, exigirHmac? }
// Idempotente em relacao ao noId (1:1).
roteador.post('/fluxo/:fluxoId', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;
    if (!(await fluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const { noId, descricao, exigirHmac } = req.body || {};
    if (typeof noId !== 'string' || !noId) {
      return res.status(400).json({ erro: 'Campo "noId" e obrigatorio.' });
    }

    // Confirma que o no existe e e do tipo WEBHOOK no fluxo informado.
    const no = await prisma.no.findFirst({ where: { id: noId, fluxoId } });
    if (!no) return res.status(400).json({ erro: 'No nao pertence ao fluxo.' });
    if (no.tipo !== 'WEBHOOK') {
      return res.status(400).json({ erro: 'Apenas nos do tipo WEBHOOK podem ter webhook.' });
    }

    const descLimpa = validarDescricao(descricao);
    if (descLimpa === undefined) {
      return res.status(400).json({ erro: 'Descricao invalida.' });
    }

    const webhookExistente = await prisma.webhook.findUnique({ where: { noId } });
    if (webhookExistente) return res.status(200).json(webhookExistente);

    const webhook = await prisma.webhook.create({
      data: {
        fluxoId,
        noId,
        segredo: gerarSegredo(),
        descricao: descLimpa,
        exigirHmac: typeof exigirHmac === 'boolean' ? exigirHmac : false,
      },
    });
    res.status(201).json(webhook);
  } catch (erro) {
    console.error('[webhooks/criar]', erro);
    res.status(500).json({ erro: 'Erro ao criar webhook.' });
  }
});

// PATCH /webhooks/:id  body: { ativo?, descricao?, exigirHmac? }
roteador.patch('/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await webhookDoTenant(id, req.usuario);
    if (!webhook) return res.status(404).json({ erro: 'Webhook nao encontrado.' });

    const dados = {};
    const { ativo, descricao, exigirHmac } = req.body || {};
    if (ativo !== undefined) {
      if (typeof ativo !== 'boolean') return res.status(400).json({ erro: '"ativo" deve ser booleano.' });
      dados.ativo = ativo;
    }
    if (exigirHmac !== undefined) {
      if (typeof exigirHmac !== 'boolean') return res.status(400).json({ erro: '"exigirHmac" deve ser booleano.' });
      dados.exigirHmac = exigirHmac;
    }
    if (descricao !== undefined) {
      const limpa = validarDescricao(descricao);
      if (limpa === undefined) return res.status(400).json({ erro: 'Descricao invalida.' });
      dados.descricao = limpa;
    }

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }

    const atualizado = await prisma.webhook.update({ where: { id }, data: dados });
    res.json(atualizado);
  } catch (erro) {
    console.error('[webhooks/atualizar]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar webhook.' });
  }
});

// POST /webhooks/:id/regenerar-segredo
roteador.post('/:id/regenerar-segredo', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await webhookDoTenant(id, req.usuario);
    if (!webhook) return res.status(404).json({ erro: 'Webhook nao encontrado.' });

    const atualizado = await prisma.webhook.update({
      where: { id },
      data: { segredo: gerarSegredo() },
    });
    res.json(atualizado);
  } catch (erro) {
    console.error('[webhooks/regenerar]', erro);
    res.status(500).json({ erro: 'Erro ao regenerar segredo.' });
  }
});

// DELETE /webhooks/:id
roteador.delete('/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await webhookDoTenant(id, req.usuario);
    if (!webhook) return res.status(404).json({ erro: 'Webhook nao encontrado.' });

    await prisma.webhook.delete({ where: { id } });
    res.json({ mensagem: 'Webhook excluido.' });
  } catch (erro) {
    console.error('[webhooks/excluir]', erro);
    res.status(500).json({ erro: 'Erro ao excluir webhook.' });
  }
});

module.exports = roteador;
