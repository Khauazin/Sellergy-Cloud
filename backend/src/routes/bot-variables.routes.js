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

async function botPertenceAoTenant(botId, usuario) {
  if (ehAdmin(usuario)) {
    const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true } });
    return !!bot;
  }
  const bot = await prisma.bot.findFirst({
    where: { id: botId, clienteId: usuario.clienteId },
    select: { id: true }
  });
  return !!bot;
}

async function variavelPertenceAoTenant(varId, usuario) {
  if (ehAdmin(usuario)) {
    const v = await prisma.botVariable.findUnique({ where: { id: varId }, select: { id: true } });
    return !!v;
  }
  const v = await prisma.botVariable.findFirst({
    where: { id: varId, bot: { clienteId: usuario.clienteId } },
    select: { id: true }
  });
  return !!v;
}

roteador.get('/:botId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { botId } = req.params;

    if (!(await botPertenceAoTenant(botId, req.usuario))) {
      return res.status(404).json({ error: 'Bot nao encontrado' });
    }

    const variables = await prisma.botVariable.findMany({
      where: { botId },
      orderBy: { key: 'asc' }
    });
    res.json(variables);
  } catch (error) {
    console.error('[bot-variables/list]', error);
    res.status(500).json({ error: 'Erro ao buscar variaveis' });
  }
});

roteador.post('/', requerPermissao('BOTS', 'criar'), async (req, res) => {
  try {
    const { botId, key, value, description, type } = req.body;

    if (!(await botPertenceAoTenant(botId, req.usuario))) {
      return res.status(403).json({ error: 'Bot nao pertence a este tenant.' });
    }

    const variable = await prisma.botVariable.create({
      data: { botId, key, value, description, type }
    });
    res.status(201).json(variable);
  } catch (error) {
    console.error('[bot-variables/create]', error);
    res.status(500).json({ error: 'Erro ao criar variavel' });
  }
});

roteador.put('/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await variavelPertenceAoTenant(id, req.usuario))) {
      return res.status(404).json({ error: 'Variavel nao encontrada' });
    }

    const { value } = req.body;
    const variable = await prisma.botVariable.update({
      where: { id },
      data: { value }
    });
    res.json(variable);
  } catch (error) {
    console.error('[bot-variables/update]', error);
    res.status(500).json({ error: 'Erro ao atualizar variavel' });
  }
});

roteador.delete('/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await variavelPertenceAoTenant(id, req.usuario))) {
      return res.status(404).json({ error: 'Variavel nao encontrada' });
    }

    await prisma.botVariable.delete({ where: { id } });
    res.json({ message: 'Variavel excluida com sucesso' });
  } catch (error) {
    console.error('[bot-variables/delete]', error);
    res.status(500).json({ error: 'Erro ao excluir variavel' });
  }
});

module.exports = roteador;
