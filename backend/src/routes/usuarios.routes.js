const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Todas as rotas de usuários exigem autenticação
router.use(middlewareAutenticacao);

// Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        criadoEm: true,
      }
    });
    res.json(usuarios);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Falha ao buscar usuários' });
  }
});

// Criar novo usuário (Admin)
router.post('/', async (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  try {
    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Este e-mail já está em uso' });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHasheada = await bcrypt.hash(senha, salt);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHasheada,
        perfil: perfil || 'ADMIN',
      },
      select: { id: true, nome: true, email: true, perfil: true }
    });

    res.status(201).json(novoUsuario);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Atualizar usuário
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha, perfil } = req.body;

  try {
    const dataToUpdate = { nome, email, perfil };

    if (senha) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.senha = await bcrypt.hash(senha, salt);
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, nome: true, email: true, perfil: true }
    });

    res.json(usuarioAtualizado);
  } catch (erro) {
    console.error(erro);
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Este e-mail já está em uso' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

// Excluir usuário
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode excluir a si mesmo' });
  }

  try {
    await prisma.usuario.delete({ where: { id } });
    res.json({ mensagem: 'Usuário excluído com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao excluir usuário' });
  }
});

module.exports = router;
