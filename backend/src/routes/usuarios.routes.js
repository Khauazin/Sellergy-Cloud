const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { requerAdmin } = require('../middlewares/permissoes.middleware');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Esta rota gerencia usuarios em nivel de SISTEMA (admins).
// Apenas o ADMIN do sistema tem acesso. Colaboradores de cliente sao
// gerenciados pelo CrmUsuariosController via /crm/usuarios.
router.use(middlewareAutenticacao);
router.use(requerAdmin);

// Listar todos os admins do sistema (perfil ADMIN, sem clienteId)
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { perfil: 'ADMIN' },
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
    console.error('[usuarios/list]', erro);
    res.status(500).json({ erro: 'Falha ao buscar usuarios' });
  }
});

// Criar um novo admin do sistema
router.post('/', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, email e senha sao obrigatorios.' });
  }

  if (typeof senha !== 'string' || senha.length < 6) {
    return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres.' });
  }

  try {
    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Este e-mail ja esta em uso' });
    }

    const senhaHasheada = await bcrypt.hash(senha, 12);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHasheada,
        perfil: 'ADMIN', // Sempre ADMIN nesta rota; nunca aceitar perfil do body.
      },
      select: { id: true, nome: true, email: true, perfil: true }
    });

    res.status(201).json(novoUsuario);
  } catch (erro) {
    console.error('[usuarios/create]', erro);
    res.status(500).json({ erro: 'Erro ao criar usuario' });
  }
});

// Atualizar admin do sistema
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha } = req.body;

  try {
    // Garante que o alvo eh um ADMIN do sistema.
    const alvo = await prisma.usuario.findUnique({ where: { id } });
    if (!alvo || alvo.perfil !== 'ADMIN') {
      return res.status(404).json({ erro: 'Administrador nao encontrado.' });
    }

    const dataToUpdate = { nome, email };

    if (senha) {
      if (typeof senha !== 'string' || senha.length < 6) {
        return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres.' });
      }
      dataToUpdate.senha = await bcrypt.hash(senha, 12);
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, nome: true, email: true, perfil: true }
    });

    res.json(usuarioAtualizado);
  } catch (erro) {
    console.error('[usuarios/update]', erro);
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Este e-mail ja esta em uso' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar usuario' });
  }
});

// Excluir admin do sistema (impede auto-exclusao)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (id === req.usuario.id) {
    return res.status(400).json({ erro: 'Voce nao pode excluir a si mesmo' });
  }

  try {
    const alvo = await prisma.usuario.findUnique({ where: { id } });
    if (!alvo || alvo.perfil !== 'ADMIN') {
      return res.status(404).json({ erro: 'Administrador nao encontrado.' });
    }

    await prisma.usuario.delete({ where: { id } });
    res.json({ mensagem: 'Usuario excluido com sucesso' });
  } catch (erro) {
    console.error('[usuarios/delete]', erro);
    res.status(500).json({ erro: 'Erro ao excluir usuario' });
  }
});

module.exports = router;
