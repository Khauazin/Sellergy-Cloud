const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { SEGREDO_JWT } = require('../middlewares/auth.middleware');
const { definirSessao, garantirCsrf, limparSessao } = require('../utils/sessaoCookie');

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

    // Carrega modulosLiberados, segmento e branding se for usuario de tenant.
    let modulosLiberados = null;
    let branding = null;
    let segmento = null;
    if (usuario.clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: usuario.clienteId },
        select: { modulosLiberados: true, segmento: true, brandLogo: true, brandNome: true }
      });
      modulosLiberados = cliente?.modulosLiberados || {};
      segmento = cliente?.segmento || null;
      branding = { logo: cliente?.brandLogo || null, nome: cliente?.brandNome || null };
    }

    // O token vai para um cookie httpOnly e NAO volta no corpo: assim ele fica
    // fora do alcance do JavaScript e um XSS nao consegue roubar a sessao.
    // No lugar dele devolvemos o segredo de CSRF, que o front guarda em memoria.
    const csrfToken = definirSessao(res, token);

    res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        clienteId: usuario.clienteId || null,
        deveTrocarSenha: usuario.deveTrocarSenha === true,
        foto: usuario.foto || null,
        modulosLiberados,
        segmento,
        branding,
      },
      csrfToken
    });
  } catch (erro) {
    console.error('[auth/login]', erro);
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// Encerra a sessao apagando os cookies. Passou a ser obrigatorio no servidor:
// com o token em cookie httpOnly, o front nao tem como remove-lo sozinho.
// Sem autenticacao de proposito — a rota so apaga os cookies de quem chamou, e
// exigir sessao valida impediria a limpeza justamente no caso em que ela mais
// importa (cookie corrompido ou token vencido).
roteador.post('/logout', (req, res) => {
  limparSessao(res);
  res.json({ mensagem: 'Sessao encerrada.' });
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
        foto: true,
      }
    });
    if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });

    // Carrega modulos liberados, segmento, branding e horario do tenant.
    let modulosLiberados = null;
    let branding = null;
    let horarioFuncionamento = null;
    let segmento = null;
    if (usuario.clienteId) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: usuario.clienteId },
        select: { modulosLiberados: true, segmento: true, status: true, brandLogo: true, brandNome: true, horarioFuncionamento: true }
      });
      modulosLiberados = cliente?.modulosLiberados || {};
      segmento = cliente?.segmento || null;
      branding = { logo: cliente?.brandLogo || null, nome: cliente?.brandNome || null };
      horarioFuncionamento = cliente?.horarioFuncionamento || null;
    }

    res.json({
      ...usuario,
      clienteId: usuario.clienteId || null,
      modulosLiberados,
      segmento,
      branding,
      horarioFuncionamento,
      // Reentrega o segredo de CSRF: o front guarda so em memoria, entao a cada
      // recarga da pagina ele precisa receber o valor de novo por aqui.
      csrfToken: req.sessaoPorCookie ? garantirCsrf(req, res) : null,
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

// Atualiza dados pessoais do usuario logado (nome, email, foto).
// Nao permite mudar perfil/permissoes/clienteId (proteger contra escalada).
roteador.put('/perfil', middlewareAutenticacao, async (req, res) => {
  try {
    const { nome, email, foto } = req.body;
    const dataUpdate = {};
    if (nome !== undefined) dataUpdate.nome = nome;
    if (email !== undefined) dataUpdate.email = email;
    if (foto !== undefined) dataUpdate.foto = foto || null;

    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: dataUpdate,
      select: { id: true, nome: true, email: true, perfil: true, foto: true, clienteId: true }
    });

    res.json(usuario);
  } catch (erro) {
    console.error('[auth/perfil-put]', erro);
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Este e-mail ja esta em uso.' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
  }
});

// Atualiza branding (logo + nome customizado) do tenant do usuario logado.
// Apenas CLIENT (dono da conta) pode atualizar branding.
roteador.put('/branding', middlewareAutenticacao, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'CLIENT') {
      return res.status(403).json({ erro: 'Apenas o dono da conta pode alterar a marca.' });
    }
    if (!req.usuario.clienteId) {
      return res.status(400).json({ erro: 'Usuario sem tenant.' });
    }

    const { brandLogo, brandNome } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id: req.usuario.clienteId },
      data: {
        brandLogo: brandLogo === undefined ? undefined : (brandLogo || null),
        brandNome: brandNome === undefined ? undefined : (brandNome || null),
      },
      select: { id: true, brandLogo: true, brandNome: true }
    });

    res.json({ logo: cliente.brandLogo, nome: cliente.brandNome });
  } catch (erro) {
    console.error('[auth/branding]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar marca.' });
  }
});

// Atualiza horario de funcionamento do tenant (usado pelo cron diario do
// caixa e por outras automacoes). So CLIENT (dono) pode editar.
// Formato esperado: { abertura: 'HH:MM', fechamento: 'HH:MM', dias: [0-6] }
roteador.put('/horario-funcionamento', middlewareAutenticacao, async (req, res) => {
  try {
    if (req.usuario.perfil !== 'CLIENT' && req.usuario.perfil !== 'ADMINISTRADOR') {
      return res.status(403).json({ erro: 'Apenas o dono da conta ou administradores podem alterar o horario.' });
    }
    if (!req.usuario.clienteId) {
      return res.status(400).json({ erro: 'Usuario sem tenant.' });
    }

    const { abertura, fechamento, dias } = req.body;
    // Valida formato HH:MM (basico — front ja restringe via type="time").
    const ehHora = (h) => typeof h === 'string' && /^\d{1,2}:\d{2}$/.test(h);
    if (abertura && !ehHora(abertura)) return res.status(422).json({ erro: 'abertura invalida (use HH:MM)' });
    if (fechamento && !ehHora(fechamento)) return res.status(422).json({ erro: 'fechamento invalido (use HH:MM)' });

    // dias = array de 0-6 (0=domingo, 6=sabado). Default = seg-sab.
    let diasValidos = [1, 2, 3, 4, 5, 6];
    if (Array.isArray(dias)) {
      diasValidos = dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    }

    const horarioFuncionamento = {
      abertura: abertura || '08:00',
      fechamento: fechamento || '18:00',
      dias: diasValidos,
    };

    const cliente = await prisma.cliente.update({
      where: { id: req.usuario.clienteId },
      data: { horarioFuncionamento },
      select: { id: true, horarioFuncionamento: true },
    });

    res.json({ horarioFuncionamento: cliente.horarioFuncionamento });
  } catch (erro) {
    console.error('[auth/horario-funcionamento]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar horario.' });
  }
});

module.exports = roteador;
