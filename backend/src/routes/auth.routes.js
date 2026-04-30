const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { SEGREDO_JWT } = require('../middlewares/auth.middleware');

const roteador = express.Router();

// Limitador agressivo para login: protege contra brute force.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 tentativas por IP por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});

// Limitador moderado para registro: evita criacao em massa.
const limitadorRegistro = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de registro. Tente novamente mais tarde.' }
});

roteador.post('/registrar', limitadorRegistro, async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha sao obrigatorios' });
    }

    if (typeof senha !== 'string' || senha.length < 6) {
      return res.status(400).json({ erro: 'Senha deve ter ao menos 6 caracteres' });
    }

    const usuarioExiste = await prisma.usuario.findUnique({ where: { email } });
    if (usuarioExiste) {
      return res.status(400).json({ erro: 'E-mail ja cadastrado' });
    }

    const senhaHasheada = await bcrypt.hash(senha, 12);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHasheada,
      },
    });

    res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  } catch (erro) {
    console.error('[auth/registrar]', erro);
    res.status(500).json({ erro: 'Erro ao registrar usuario' });
  }
});

roteador.post('/login', limitadorLogin, async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha sao obrigatorios' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Mantem tempo de resposta similar entre "usuario inexistente" e "senha errada"
    // para nao expor enumeracao de usuarios via timing.
    const hashComparacao = usuario?.senha || '$2a$12$invalidplaceholderhashinvalidplaceholderhashinvalida';
    const senhaValida = await bcrypt.compare(senha, hashComparacao);

    if (!usuario || !senhaValida) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil, clienteId: usuario.clienteId },
      SEGREDO_JWT,
      { expiresIn: '7d' }
    );

    res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        clienteId: usuario.clienteId || null,
        deveTrocarSenha: usuario.deveTrocarSenha === true,
      },
      token
    });
  } catch (erro) {
    console.error('[auth/login]', erro);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

roteador.get('/perfil', middlewareAutenticacao, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        clienteId: true,
        deveTrocarSenha: true,
        permissoes: true,
      }
    });
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    // Carrega modulos liberados do tenant para o frontend filtrar telas.
    let modulosLiberados = null;
    if (usuario.clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: usuario.clienteId },
        select: { modulosLiberados: true, status: true }
      });
      modulosLiberados = cliente?.modulosLiberados || {};
    }

    res.json({
      ...usuario,
      clienteId: usuario.clienteId || null,
      modulosLiberados,
    });
  } catch (erro) {
    console.error('[auth/perfil]', erro);
    res.status(500).json({ erro: 'Erro ao buscar perfil' });
  }
});

// Permite ao usuario logado trocar a propria senha.
// Tambem zera a flag deveTrocarSenha.
roteador.post('/trocar-senha', middlewareAutenticacao, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ erro: 'senhaAtual e novaSenha sao obrigatorias.' });
    }

    if (typeof novaSenha !== 'string' || novaSenha.length < 6) {
      return res.status(400).json({ erro: 'A nova senha deve ter ao menos 6 caracteres.' });
    }

    if (senhaAtual === novaSenha) {
      return res.status(400).json({ erro: 'A nova senha deve ser diferente da atual.' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado.' });

    const senhaConfere = await bcrypt.compare(senhaAtual, usuario.senha);
    if (!senhaConfere) {
      return res.status(401).json({ erro: 'Senha atual incorreta.' });
    }

    const novaHash = await bcrypt.hash(novaSenha, 12);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: novaHash,
        deveTrocarSenha: false,
      }
    });

    res.json({ mensagem: 'Senha atualizada com sucesso.' });
  } catch (erro) {
    console.error('[auth/trocar-senha]', erro);
    res.status(500).json({ erro: 'Erro ao trocar senha.' });
  }
});

module.exports = roteador;
