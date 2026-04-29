const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { criadoEm: 'desc' }
    });
    res.json(clientes);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

roteador.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        bots: true,
      }
    });
    
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
    
    res.json(cliente);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar detalhes do cliente' });
  }
});

roteador.post('/', async (req, res) => {
  try {
    const { nome, email, telefone, segmento, plano, mensalidade } = req.body;

    if (!email) {
      return res.status(400).json({ erro: 'O e-mail é obrigatório para gerar o acesso do cliente.' });
    }

    // Usar transação para garantir integridade
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Criar o Cliente
      const cliente = await tx.cliente.create({
        data: { 
          nome, 
          email, 
          telefone, 
          segmento, 
          plano, 
          mensalidade: Number(mensalidade || 0) 
        }
      });

      // 2. Criar o Usuário de acesso para este cliente
      const salt = await bcrypt.genSalt(10);
      const senhaPadrao = '123456';
      const senhaHasheada = await bcrypt.hash(senhaPadrao, salt);

      await tx.usuario.create({
        data: {
          nome: nome,
          email: email,
          senha: senhaHasheada,
          perfil: 'CLIENT',
          clienteId: cliente.id
        }
      });

      return cliente;
    });

    res.status(201).json(resultado);
  } catch (erro) {
    console.error(erro);
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Este e-mail já está sendo usado por outro cliente ou usuário.' });
    }
    res.status(500).json({ erro: 'Erro ao criar cliente e acesso.' });
  }
});

roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone, segmento, plano, status, mensalidade } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nome, email, telefone, segmento, plano, status, mensalidade: Number(mensalidade || 0) }
    });
    res.json(cliente);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar cliente' });
  }
});

roteador.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { status }
    });
    res.json(cliente);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao alterar status do cliente' });
  }
});

roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.cliente.delete({ where: { id } });
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao excluir cliente. Verifique se ele possui bots vinculados.' });
  }
});

module.exports = roteador;
