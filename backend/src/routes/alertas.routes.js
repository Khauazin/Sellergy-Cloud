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
roteador.use(requerModuloLiberado('ALERTAS'));

function filtroTenant(req) {
  if (ehAdmin(req.usuario)) return {};
  return { clienteId: req.usuario.clienteId };
}

roteador.get('/', requerPermissao('ALERTAS', 'visualizar'), async (req, res) => {
  try {
    const alertas = await prisma.alerta.findMany({
      where: filtroTenant(req),
      include: {
        bot: { select: { nome: true } },
        cliente: { select: { nome: true } }
      },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(alertas);
  } catch (erro) {
    console.error('[alertas/list]', erro);
    res.status(500).json({ erro: 'Erro ao listar alertas' });
  }
});

roteador.patch('/:id/resolver', requerPermissao('ALERTAS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;

    const existente = await prisma.alerta.findFirst({
      where: { id, ...filtroTenant(req) },
      select: { id: true }
    });
    if (!existente) return res.status(404).json({ erro: 'Alerta nao encontrado' });

    const alerta = await prisma.alerta.update({
      where: { id },
      data: { status: 'RESOLVED', resolvidoEm: new Date(), usuarioId: req.usuario.id }
    });
    if (req.io) req.io.emit('alerta_atualizado', alerta);
    res.json(alerta);
  } catch (erro) {
    console.error('[alertas/resolver]', erro);
    res.status(500).json({ erro: 'Erro ao resolver alerta' });
  }
});

roteador.patch('/:id/ignorar', requerPermissao('ALERTAS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;

    const existente = await prisma.alerta.findFirst({
      where: { id, ...filtroTenant(req) },
      select: { id: true }
    });
    if (!existente) return res.status(404).json({ erro: 'Alerta nao encontrado' });

    const alerta = await prisma.alerta.update({
      where: { id },
      data: { status: 'IGNORED', usuarioId: req.usuario.id }
    });
    if (req.io) req.io.emit('alerta_atualizado', alerta);
    res.json(alerta);
  } catch (erro) {
    console.error('[alertas/ignorar]', erro);
    res.status(500).json({ erro: 'Erro ao ignorar alerta' });
  }
});

module.exports = roteador;
