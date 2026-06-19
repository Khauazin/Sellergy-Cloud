// Rotas de conversas e mensagens.
//
// Politica:
//  - ADMIN do sistema: pode listar metadata (canal, autor, timestamps).
//    Nunca recebe `conteudo` decifrado. Linha "[criptografado]" no lugar.
//  - Tenant member (CLIENT/ADMIN do tenant/VENDEDOR) com clienteId match:
//    recebe conteudo decifrado. Cada leitura gera linha em
//    `auditoria_mensagens`.
//  - VENDEDOR sem permissao MENSAGENS de visualizacao: bloqueado.
//
// Multi-tenant rigido: todo lookup filtra por clienteId do usuario.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
  escopoDoUsuario,
} = require('../middlewares/permissoes.middleware');
const {
  requerAcessoConteudoMensagem,
  pertenceAoTenantDoUsuario,
  auditarLeitura,
  auditarCriacao,
} = require('../middlewares/mensagens.middleware');
const { cifrar, decifrar } = require('../cripto/cofreMensagens');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

const PAGINA_LIMITE_PADRAO = 30;
const PAGINA_LIMITE_MAX = 100;
const TAMANHO_MAX_TEXTO = 50_000;

function parseLimite(valor) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) return PAGINA_LIMITE_PADRAO;
  return Math.min(n, PAGINA_LIMITE_MAX);
}

function filtroTenant(usuario) {
  if (ehAdmin(usuario)) return {};
  return { clienteId: usuario.clienteId };
}

// Filtro de ESCOPO da inbox: ADMIN/CLIENT/ADMINISTRADOR veem todas; VENDEDOR
// com escopo PROPRIAS ve so as conversas onde e o responsavel (direto por
// usuarioId, ou via o especialista vinculado a ele).
async function filtroEscopoMensagens(usuario) {
  const base = filtroTenant(usuario);
  if (ehAdmin(usuario) || usuario.perfil === 'CLIENT' || usuario.perfil === 'ADMINISTRADOR') {
    return base;
  }
  const u = await prisma.usuario.findUnique({
    where: { id: usuario.id }, select: { permissoes: true },
  });
  const escopo = escopoDoUsuario(usuario, u?.permissoes || {}, 'MENSAGENS');
  if (escopo === 'TODAS') return base;
  return {
    ...base,
    OR: [
      { usuarioId: usuario.id },
      { especialista: { usuarioId: usuario.id } },
    ],
  };
}

// ==========================================================
// LISTA DE CONVERSAS — todos os perfis (metadata)
// ==========================================================

// GET /conversas?limite=30&cursor=<id>&leadId=<id>
roteador.get(
  '/',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'visualizar'),
  async (req, res) => {
    try {
      const limite = parseLimite(req.query.limite);
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;
      const leadId = typeof req.query.leadId === 'string' && req.query.leadId ? req.query.leadId : undefined;

      const where = { ...(await filtroEscopoMensagens(req.usuario)), ...(leadId ? { leadId } : {}) };
      const conversas = await prisma.conversa.findMany({
        where,
        include: {
          lead: { select: { nome: true, telefone: true } },
          especialista: { select: { id: true, nome: true } },
        },
        orderBy: [{ ultimaMsgEm: 'desc' }, { criadoEm: 'desc' }],
        take: limite + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      const proximoCursor = conversas.length > limite ? conversas.pop().id : null;
      res.json({ itens: conversas, proximoCursor });
    } catch (erro) {
      console.error('[conversas/listar]', erro);
      res.status(500).json({ erro: 'Erro ao listar conversas.' });
    }
  }
);

// GET /conversas/:id  (metadata)
roteador.get(
  '/:id',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'visualizar'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const conversa = await prisma.conversa.findFirst({
        where: { id, ...(await filtroEscopoMensagens(req.usuario)) },
        include: {
          lead: { select: { id: true, nome: true, telefone: true } },
          especialista: { select: { id: true, nome: true } },
        },
      });
      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada.' });
      res.json(conversa);
    } catch (erro) {
      console.error('[conversas/detalhar]', erro);
      res.status(500).json({ erro: 'Erro ao buscar conversa.' });
    }
  }
);

// ==========================================================
// LISTA DE MENSAGENS — duas variantes:
//  - /conversas/:id/mensagens          -> metadata (sem conteudo)
//  - /conversas/:id/mensagens?incluirConteudo=true
//      -> requer requerAcessoConteudoMensagem (bloqueia ADMIN);
//         decifra do tenant + auditoria por leitura
// ==========================================================

roteador.get(
  '/:id/mensagens',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'visualizar'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const incluirConteudo = req.query.incluirConteudo === 'true';

      const conversa = await prisma.conversa.findFirst({
        where: { id, ...(await filtroEscopoMensagens(req.usuario)) },
        select: { id: true, clienteId: true },
      });
      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada.' });

      // Se pediu conteudo, aplica policy explicita.
      if (incluirConteudo) {
        if (ehAdmin(req.usuario)) {
          return res.status(403).json({
            erro: 'Admin do sistema nao tem acesso ao conteudo de mensagens.',
          });
        }
        if (!pertenceAoTenantDoUsuario(req.usuario, conversa.clienteId)) {
          return res.status(403).json({ erro: 'Acesso negado a esta conversa.' });
        }
      }

      const limite = parseLimite(req.query.limite);
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;

      const mensagens = await prisma.mensagemConversa.findMany({
        where: { conversaId: id },
        orderBy: { criadoEm: 'asc' },
        take: limite + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      const proximoCursor = mensagens.length > limite ? mensagens.pop().id : null;

      const ip = req.ip;
      const userAgent = req.get('user-agent') || null;

      const itens = mensagens.map((m) => {
        const base = {
          id: m.id,
          conversaId: m.conversaId,
          sentido: m.sentido,
          autor: m.autor,
          autorUsuarioId: m.autorUsuarioId,
          tipo: m.tipo,
          statusEntrega: m.statusEntrega,
          midiaUrl: m.midiaUrl,
          midiaTipoMime: m.midiaTipoMime,
          metadata: m.metadata,
          criadoEm: m.criadoEm,
        };
        if (!incluirConteudo) {
          return { ...base, conteudo: null, cifrado: true };
        }
        try {
          const conteudo = decifrar(conversa.clienteId, m);
          // Audit em background (nao bloqueia resposta)
          auditarLeitura({ mensagemId: m.id, usuario: req.usuario, ip, userAgent });
          return { ...base, conteudo, cifrado: false };
        } catch (err) {
          console.error('[conversas/decifrar]', m.id, err.message);
          return { ...base, conteudo: null, cifrado: true, erroDecifragem: true };
        }
      });

      res.json({ itens, proximoCursor });
    } catch (erro) {
      console.error('[conversas/mensagens]', erro);
      res.status(500).json({ erro: 'Erro ao listar mensagens.' });
    }
  }
);

// ==========================================================
// CRIAR MENSAGEM (apenas tenant member; admin bloqueado)
// Body: { sentido, autor, conteudo, tipo?, autorUsuarioId?, midiaUrl?, midiaTipoMime?, metadata? }
// ==========================================================

roteador.post(
  '/:id/mensagens',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'responder'),
  requerAcessoConteudoMensagem,
  async (req, res) => {
    try {
      const { id } = req.params;
      const conversa = await prisma.conversa.findFirst({
        where: { id, ...(await filtroEscopoMensagens(req.usuario)) },
        select: { id: true, clienteId: true },
      });
      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada.' });
      if (!pertenceAoTenantDoUsuario(req.usuario, conversa.clienteId)) {
        return res.status(403).json({ erro: 'Acesso negado a esta conversa.' });
      }

      const {
        sentido, autor, conteudo, tipo, autorUsuarioId,
        midiaUrl, midiaTipoMime, metadata, statusEntrega,
      } = req.body || {};

      if (!['ENTRADA', 'SAIDA'].includes(sentido)) {
        return res.status(400).json({ erro: 'sentido invalido (ENTRADA|SAIDA).' });
      }
      if (!['BOT', 'CLIENTE_FINAL', 'VENDEDOR', 'SISTEMA'].includes(autor)) {
        return res.status(400).json({ erro: 'autor invalido.' });
      }
      if (typeof conteudo !== 'string') {
        return res.status(400).json({ erro: 'conteudo deve ser string.' });
      }
      if (conteudo.length > TAMANHO_MAX_TEXTO) {
        return res.status(400).json({ erro: `conteudo excede ${TAMANHO_MAX_TEXTO} caracteres.` });
      }

      const cifrado = cifrar(conversa.clienteId, conteudo);
      const mensagem = await prisma.$transaction(async (tx) => {
        const m = await tx.mensagemConversa.create({
          data: {
            conversaId: conversa.id,
            clienteId: conversa.clienteId,
            sentido,
            autor,
            autorUsuarioId: autorUsuarioId || null,
            tipo: tipo || 'TEXTO',
            statusEntrega: statusEntrega || 'PENDENTE',
            conteudoCifrado: cifrado.conteudoCifrado,
            iv: cifrado.iv,
            tag: cifrado.tag,
            versaoChave: cifrado.versaoChave,
            midiaUrl: midiaUrl || null,
            midiaTipoMime: midiaTipoMime || null,
            metadata: metadata || null,
          },
        });
        await tx.conversa.update({
          where: { id: conversa.id },
          data: { ultimaMsgEm: new Date() },
        });
        return m;
      });

      auditarCriacao({
        mensagemId: mensagem.id,
        usuario: req.usuario,
        ip: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      res.status(201).json({
        id: mensagem.id,
        conversaId: mensagem.conversaId,
        sentido: mensagem.sentido,
        autor: mensagem.autor,
        tipo: mensagem.tipo,
        statusEntrega: mensagem.statusEntrega,
        criadoEm: mensagem.criadoEm,
      });
    } catch (erro) {
      console.error('[conversas/criar-mensagem]', erro);
      res.status(500).json({ erro: 'Erro ao registrar mensagem.' });
    }
  }
);

// ==========================================================
// CRIAR CONVERSA
// Body: { leadId?, botId?, canal?, identificador? }
// ==========================================================

roteador.post(
  '/',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'responder'),
  async (req, res) => {
    try {
      if (ehAdmin(req.usuario)) {
        return res.status(403).json({ erro: 'Admin do sistema nao cria conversas de tenant.' });
      }
      const clienteId = req.usuario.clienteId;
      if (!clienteId) return res.status(403).json({ erro: 'Usuario sem tenant.' });

      const { leadId, botId, canal, identificador } = req.body || {};
      const conversa = await prisma.conversa.create({
        data: {
          clienteId,
          leadId: leadId || null,
          botId: botId || null,
          canal: canal || 'WHATSAPP',
          identificador: identificador || null,
        },
      });
      res.status(201).json(conversa);
    } catch (erro) {
      console.error('[conversas/criar]', erro);
      res.status(500).json({ erro: 'Erro ao criar conversa.' });
    }
  }
);

// ==========================================================
// HANDOFF — assumir / devolver / atribuir (Fase 2.2)
// ==========================================================

// PATCH /conversas/:id/assumir — humano assume; o bot para de responder
// (o dispatcher respeita estado.aguardandoHumano).
roteador.patch(
  '/:id/assumir',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'responder'),
  async (req, res) => {
    try {
      const conversa = await prisma.conversa.findFirst({
        where: { id: req.params.id, ...(await filtroEscopoMensagens(req.usuario)) },
        select: { id: true, estado: true },
      });
      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada.' });
      const estado = conversa.estado && typeof conversa.estado === 'object' ? conversa.estado : {};
      const atualizada = await prisma.conversa.update({
        where: { id: conversa.id },
        data: {
          usuarioId: req.usuario.id,
          estado: { ...estado, aguardandoHumano: true, humanoAssumiuEm: new Date().toISOString() },
        },
      });
      res.json(atualizada);
    } catch (erro) {
      console.error('[conversas/assumir]', erro);
      res.status(500).json({ erro: 'Erro ao assumir conversa.' });
    }
  }
);

// PATCH /conversas/:id/devolver — devolve o controle ao bot (limpa o handoff).
roteador.patch(
  '/:id/devolver',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'responder'),
  async (req, res) => {
    try {
      const conversa = await prisma.conversa.findFirst({
        where: { id: req.params.id, ...(await filtroEscopoMensagens(req.usuario)) },
        select: { id: true, estado: true },
      });
      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada.' });
      const estado = conversa.estado && typeof conversa.estado === 'object' ? conversa.estado : {};
      // Remove as marcas de handoff; preserva o resto do estado da conversa.
      const { aguardandoHumano, humanoAssumiuEm, motivoEscalada, escaladoEm, ...resto } = estado;
      const atualizada = await prisma.conversa.update({
        where: { id: conversa.id },
        data: { estado: resto },
      });
      res.json(atualizada);
    } catch (erro) {
      console.error('[conversas/devolver]', erro);
      res.status(500).json({ erro: 'Erro ao devolver conversa ao bot.' });
    }
  }
);

// PATCH /conversas/:id/atribuir — define o responsavel. Exige escopo TODAS
// (so quem ve todas pode reatribuir). Body: { usuarioId?, especialistaId? }.
roteador.patch(
  '/:id/atribuir',
  requerModuloLiberado('MENSAGENS'),
  requerPermissao('MENSAGENS', 'atribuir'),
  async (req, res) => {
    try {
      const u = await prisma.usuario.findUnique({
        where: { id: req.usuario.id }, select: { permissoes: true },
      });
      const escopo = escopoDoUsuario(req.usuario, u?.permissoes || {}, 'MENSAGENS');
      if (escopo !== 'TODAS') {
        return res.status(403).json({ erro: 'Reatribuir conversas exige escopo "todas".' });
      }

      const conversa = await prisma.conversa.findFirst({
        where: { id: req.params.id, ...filtroTenant(req.usuario) },
        select: { id: true, clienteId: true },
      });
      if (!conversa) return res.status(404).json({ erro: 'Conversa nao encontrada.' });

      const { usuarioId, especialistaId } = req.body || {};
      const data = {};
      if (usuarioId !== undefined) {
        if (usuarioId === null) {
          data.usuarioId = null;
        } else {
          const alvo = await prisma.usuario.findFirst({
            where: { id: usuarioId, clienteId: conversa.clienteId }, select: { id: true },
          });
          if (!alvo) return res.status(400).json({ erro: 'Usuario nao pertence ao tenant.' });
          data.usuarioId = alvo.id;
        }
      }
      if (especialistaId !== undefined) {
        if (especialistaId === null) {
          data.especialistaId = null;
        } else {
          const esp = await prisma.especialista.findFirst({
            where: { id: especialistaId, clienteId: conversa.clienteId }, select: { id: true },
          });
          if (!esp) return res.status(400).json({ erro: 'Especialista nao pertence ao tenant.' });
          data.especialistaId = esp.id;
        }
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ erro: 'Informe usuarioId e/ou especialistaId.' });
      }

      const atualizada = await prisma.conversa.update({ where: { id: conversa.id }, data });
      res.json(atualizada);
    } catch (erro) {
      console.error('[conversas/atribuir]', erro);
      res.status(500).json({ erro: 'Erro ao atribuir conversa.' });
    }
  }
);

module.exports = roteador;
