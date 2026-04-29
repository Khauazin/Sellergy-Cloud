const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', async (req, res) => {
  try {
    const alertas = await prisma.alerta.findMany({
      include: {
        bot: { select: { nome: true } },
        cliente: { select: { nome: true } }
      },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(alertas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar alertas' });
  }
});

roteador.patch('/:id/resolver', async (req, res) => {
  try {
    const { id } = req.params;
    const alerta = await prisma.alerta.update({
      where: { id },
      data: { status: 'RESOLVED', resolvidoEm: new Date(), usuarioId: req.usuario.id }
    });
    if (req.io) req.io.emit('alerta_atualizado', alerta);
    res.json(alerta);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao resolver alerta' });
  }
});

roteador.patch('/:id/ignorar', async (req, res) => {
  try {
    const { id } = req.params;
    const alerta = await prisma.alerta.update({
      where: { id },
      data: { status: 'IGNORED', usuarioId: req.usuario.id }
    });
    if (req.io) req.io.emit('alerta_atualizado', alerta);
    res.json(alerta);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao ignorar alerta' });
  }
});

module.exports = roteador;
