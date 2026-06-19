// Rotas ADMIN da credencial de IA de PLATAFORMA + medicao de uso por tenant.
// (Fase 3.2)
//
// A credencial de plataforma (clienteId null) e a chave de IA padrao usada
// pelos bots quando o tenant nao tem credencial propria. So o ADMIN do sistema
// mexe nela. Cifrada com a chave estavel de plataforma (CLIENTE_ID_PLATAFORMA).
//
// Politica de segredos: dadosCifrados/iv/tag NUNCA saem da API (igual ao CRUD
// de credenciais do tenant). O admin define a chave, mas nao a le de volta.
//
// Modelo: 1 credencial de plataforma por provedor (tipo). Pra rotacionar a
// chave, edite a existente (re-cifra os dados).

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { requerAdmin } = require('../middlewares/permissoes.middleware');
const { cifrarPayload, normalizarPayload } = require('../cripto/cofreCredenciais');
const { CLIENTE_ID_PLATAFORMA } = require('../credenciais');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerAdmin);

// So provedores de IA fazem sentido como credencial de plataforma.
const TIPOS_IA = {
  OPENAI_API_KEY: { obrigatorios: ['apiKey'], opcionais: ['organizationId'], rotulo: 'OpenAI' },
  ANTHROPIC_API_KEY: { obrigatorios: ['apiKey'], opcionais: [], rotulo: 'Anthropic' },
  GEMINI_API_KEY: { obrigatorios: ['apiKey'], opcionais: [], rotulo: 'Google Gemini' },
};

const TAM_MAX_NOME = 120;
const TAM_MAX_DESCRICAO = 500;
const TAM_MAX_VALOR_CAMPO = 8000;
const DIAS_PADRAO_USO = 30;

function validarPayloadIa(tipo, dados) {
  const schema = TIPOS_IA[tipo];
  if (!schema) return { erro: `Tipo de IA invalido: ${tipo}. Use: ${Object.keys(TIPOS_IA).join(', ')}.` };
  if (!dados || typeof dados !== 'object') return { erro: 'dados deve ser objeto.' };
  for (const campo of schema.obrigatorios) {
    const v = dados[campo];
    if (typeof v !== 'string' || !v.trim()) return { erro: `Campo obrigatorio faltando: ${campo}.` };
    if (v.length > TAM_MAX_VALOR_CAMPO) return { erro: `Campo ${campo} excede ${TAM_MAX_VALOR_CAMPO} caracteres.` };
  }
  return { ok: true };
}

function semSegredos(c) {
  if (!c) return c;
  // eslint-disable-next-line no-unused-vars
  const { dadosCifrados, iv, tag, ...resto } = c;
  return resto;
}

// ==========================================
// META — provedores de IA suportados + schema
// ==========================================
roteador.get('/tipos', (req, res) => {
  res.json(
    Object.entries(TIPOS_IA).map(([tipo, s]) => ({
      tipo,
      rotulo: s.rotulo,
      schema: { obrigatorios: s.obrigatorios, opcionais: s.opcionais },
    }))
  );
});

// ==========================================
// LISTAR — credenciais de plataforma (metadata)
// ==========================================
roteador.get('/credenciais', async (req, res) => {
  try {
    const itens = await prisma.credencial.findMany({
      where: { clienteId: null, tipo: { in: Object.keys(TIPOS_IA) } },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(itens.map(semSegredos));
  } catch (erro) {
    console.error('[admin-ia/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar credenciais de plataforma.' });
  }
});

// ==========================================
// CRIAR — 1 por provedor (409 se ja existe)
// Body: { nome, tipo, descricao?, dados: { apiKey, ... } }
// ==========================================
roteador.post('/credenciais', async (req, res) => {
  try {
    const { nome, tipo, descricao, dados } = req.body || {};

    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > TAM_MAX_NOME) {
      return res.status(400).json({ erro: `Nome obrigatorio (2-${TAM_MAX_NOME} chars).` });
    }
    if (!TIPOS_IA[tipo]) {
      return res.status(400).json({ erro: `Tipo invalido. Use: ${Object.keys(TIPOS_IA).join(', ')}.` });
    }
    if (typeof descricao === 'string' && descricao.length > TAM_MAX_DESCRICAO) {
      return res.status(400).json({ erro: `Descricao excede ${TAM_MAX_DESCRICAO} caracteres.` });
    }

    const jaExiste = await prisma.credencial.findFirst({ where: { clienteId: null, tipo } });
    if (jaExiste) {
      return res.status(409).json({ erro: 'Ja existe uma credencial de plataforma para este provedor. Edite a existente para trocar a chave.' });
    }

    const payload = normalizarPayload(dados);
    const valid = validarPayloadIa(tipo, payload);
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    const cifrado = cifrarPayload(CLIENTE_ID_PLATAFORMA, payload);
    const credencial = await prisma.credencial.create({
      data: {
        clienteId: null,
        nome: nome.trim(),
        tipo,
        descricao: typeof descricao === 'string' ? descricao.trim() || null : null,
        dadosCifrados: cifrado.conteudoCifrado,
        iv: cifrado.iv,
        tag: cifrado.tag,
        versaoChave: cifrado.versaoChave,
        criadoPorId: req.usuario.id || null,
      },
    });
    res.status(201).json(semSegredos(credencial));
  } catch (erro) {
    console.error('[admin-ia/criar]', erro);
    res.status(500).json({ erro: 'Erro ao criar credencial de plataforma.' });
  }
});

// ==========================================
// ATUALIZAR — nome/descricao OU troca a chave (re-cifra)
// ==========================================
roteador.put('/credenciais/:id', async (req, res) => {
  try {
    const credencial = await prisma.credencial.findFirst({ where: { id: req.params.id, clienteId: null } });
    if (!credencial) return res.status(404).json({ erro: 'Credencial de plataforma nao encontrada.' });

    const { nome, descricao, dados } = req.body || {};
    const data = {};

    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > TAM_MAX_NOME) {
        return res.status(400).json({ erro: `Nome invalido (2-${TAM_MAX_NOME} chars).` });
      }
      data.nome = nome.trim();
    }
    if (descricao !== undefined) {
      if (descricao !== null && typeof descricao !== 'string') return res.status(400).json({ erro: 'Descricao deve ser texto ou null.' });
      if (typeof descricao === 'string' && descricao.length > TAM_MAX_DESCRICAO) return res.status(400).json({ erro: `Descricao excede ${TAM_MAX_DESCRICAO} caracteres.` });
      data.descricao = descricao ? descricao.trim() : null;
    }
    if (dados !== undefined) {
      const payload = normalizarPayload(dados);
      const valid = validarPayloadIa(credencial.tipo, payload);
      if (valid.erro) return res.status(400).json({ erro: valid.erro });
      const cifrado = cifrarPayload(CLIENTE_ID_PLATAFORMA, payload);
      data.dadosCifrados = cifrado.conteudoCifrado;
      data.iv = cifrado.iv;
      data.tag = cifrado.tag;
      data.versaoChave = cifrado.versaoChave;
    }

    if (Object.keys(data).length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });

    const atualizada = await prisma.credencial.update({ where: { id: credencial.id }, data });
    res.json(semSegredos(atualizada));
  } catch (erro) {
    console.error('[admin-ia/atualizar]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar credencial de plataforma.' });
  }
});

// ==========================================
// EXCLUIR
// ==========================================
roteador.delete('/credenciais/:id', async (req, res) => {
  try {
    const credencial = await prisma.credencial.findFirst({ where: { id: req.params.id, clienteId: null } });
    if (!credencial) return res.status(404).json({ erro: 'Credencial de plataforma nao encontrada.' });
    await prisma.credencial.delete({ where: { id: credencial.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[admin-ia/excluir]', erro);
    res.status(500).json({ erro: 'Erro ao excluir credencial de plataforma.' });
  }
});

// ==========================================
// USO — medicao de IA agregada por tenant (controle de custo -> preco)
// GET /admin/ia/uso?desde=ISO  (default: ultimos 30 dias)
// ==========================================
roteador.get('/uso', async (req, res) => {
  try {
    const desde = req.query.desde
      ? new Date(req.query.desde)
      : new Date(Date.now() - DIAS_PADRAO_USO * 24 * 60 * 60 * 1000);
    if (Number.isNaN(desde.getTime())) {
      return res.status(400).json({ erro: 'Parametro desde invalido (use ISO).' });
    }
    const where = { criadoEm: { gte: desde } };

    const [porTenant, porProvedor] = await Promise.all([
      prisma.usoIa.groupBy({
        by: ['clienteId'],
        where,
        _sum: { tokens: true },
        _count: { _all: true },
        _max: { criadoEm: true },
      }),
      prisma.usoIa.groupBy({
        by: ['provedor', 'modelo'],
        where,
        _sum: { tokens: true },
        _count: { _all: true },
      }),
    ]);

    const ids = porTenant.map((g) => g.clienteId).filter(Boolean);
    const clientes = ids.length
      ? await prisma.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, plano: true } })
      : [];
    const mapa = new Map(clientes.map((c) => [c.id, c]));

    const tenants = porTenant
      .map((g) => ({
        clienteId: g.clienteId,
        nome: mapa.get(g.clienteId)?.nome || '(cliente removido)',
        plano: mapa.get(g.clienteId)?.plano || null,
        tokens: g._sum.tokens || 0,
        execucoes: g._count._all,
        ultimoUso: g._max.criadoEm,
      }))
      .sort((a, b) => b.tokens - a.tokens);

    const provedores = porProvedor
      .map((g) => ({ provedor: g.provedor, modelo: g.modelo, tokens: g._sum.tokens || 0, execucoes: g._count._all }))
      .sort((a, b) => b.tokens - a.tokens);

    res.json({
      desde,
      totalTokens: tenants.reduce((a, t) => a + t.tokens, 0),
      totalExecucoes: tenants.reduce((a, t) => a + t.execucoes, 0),
      tenants,
      provedores,
    });
  } catch (erro) {
    console.error('[admin-ia/uso]', erro);
    res.status(500).json({ erro: 'Erro ao carregar uso de IA.' });
  }
});

module.exports = roteador;
