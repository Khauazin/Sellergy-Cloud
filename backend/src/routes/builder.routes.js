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

// Helper: garante que o bot pertence ao tenant do solicitante (ou ADMIN).
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

async function fluxoPertenceAoTenant(flowId, usuario) {
  if (ehAdmin(usuario)) {
    const fl = await prisma.flow.findUnique({ where: { id: flowId }, select: { id: true } });
    return !!fl;
  }
  const fl = await prisma.flow.findFirst({
    where: { id: flowId, bot: { clienteId: usuario.clienteId } },
    select: { id: true }
  });
  return !!fl;
}

// ==========================================
// FLOWS
// ==========================================

roteador.get('/flows/:botId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { botId } = req.params;

    if (!(await botPertenceAoTenant(botId, req.usuario))) {
      return res.status(404).json({ error: 'Bot nao encontrado' });
    }

    const flows = await prisma.flow.findMany({
      where: { botId },
      include: { nodes: true, edges: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(flows);
  } catch (error) {
    console.error('[builder/flows]', error);
    res.status(500).json({ error: 'Erro ao buscar fluxos' });
  }
});

roteador.post('/flows', requerPermissao('BOTS', 'criar'), async (req, res) => {
  try {
    const { botId, name, isActive, triggerType, triggerKeyword } = req.body;

    if (!(await botPertenceAoTenant(botId, req.usuario))) {
      return res.status(403).json({ error: 'Bot nao pertence a este tenant.' });
    }

    const flow = await prisma.flow.create({
      data: { botId, name, isActive, triggerType, triggerKeyword }
    });
    res.status(201).json(flow);
  } catch (error) {
    console.error('[builder/create-flow]', error);
    res.status(500).json({ error: 'Erro ao criar fluxo' });
  }
});

roteador.put('/flows/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await fluxoPertenceAoTenant(id, req.usuario))) {
      return res.status(404).json({ error: 'Fluxo nao encontrado' });
    }

    const { name, isActive, triggerType, triggerKeyword } = req.body;
    const flow = await prisma.flow.update({
      where: { id },
      data: { name, isActive, triggerType, triggerKeyword }
    });
    res.json(flow);
  } catch (error) {
    console.error('[builder/update-flow]', error);
    res.status(500).json({ error: 'Erro ao atualizar fluxo' });
  }
});

roteador.delete('/flows/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await fluxoPertenceAoTenant(id, req.usuario))) {
      return res.status(404).json({ error: 'Fluxo nao encontrado' });
    }

    await prisma.flow.delete({ where: { id } });
    res.json({ message: 'Fluxo excluido com sucesso' });
  } catch (error) {
    console.error('[builder/delete-flow]', error);
    res.status(500).json({ error: 'Erro ao excluir fluxo' });
  }
});

// ==========================================
// NODES & EDGES
// ==========================================

roteador.post('/flows/:flowId/canvas', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { flowId } = req.params;
    const { nodes, edges } = req.body;

    if (!(await fluxoPertenceAoTenant(flowId, req.usuario))) {
      return res.status(404).json({ error: 'Fluxo nao encontrado' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.node.deleteMany({ where: { flowId } });
      await tx.edge.deleteMany({ where: { flowId } });

      if (nodes && nodes.length > 0) {
        await tx.node.createMany({
          data: nodes.map(n => ({
            id: n.id,
            flowId,
            type: n.data?.dbType || 'MESSAGE',
            positionX: n.position.x,
            positionY: n.position.y,
            data: n.data || {}
          }))
        });
      }

      if (edges && edges.length > 0) {
        await tx.edge.createMany({
          data: edges.map(e => ({
            id: e.id,
            flowId,
            sourceNodeId: e.source,
            targetNodeId: e.target,
            sourceHandle: e.sourceHandle || null
          }))
        });
      }
    });

    res.json({ message: 'Canvas salvo com sucesso' });
  } catch (error) {
    console.error('[builder/save-canvas]', error);
    res.status(500).json({ error: 'Erro ao salvar construtor de fluxo' });
  }
});

module.exports = roteador;
