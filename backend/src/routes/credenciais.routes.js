// CRUD de credenciais (chaves de API). Apenas tenant member com permissao
// CONFIGURACOES.editar pode criar/editar/excluir. ADMIN do sistema pode
// listar metadata, mas NUNCA recebe os dados decifrados.
//
// Politica:
//   - GET /credenciais — lista metadata (id, nome, tipo, ultimoUsoEm, ...).
//     `dadosCifrados`/`iv`/`tag` NUNCA saem da API.
//   - POST /credenciais — cria nova; o backend cifra antes de gravar.
//   - PUT /credenciais/:id — atualiza nome/descricao OU substitui dados
//     (re-cifra). Substituicao de dados regenera iv/tag.
//   - DELETE /credenciais/:id — apaga.
//   - GET /credenciais/tipos — lista enum TipoCredencial com schema.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { cifrarPayload, normalizarPayload } = require('../cripto/cofreCredenciais');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

const TIPOS_VALIDOS = new Set([
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'WHATSAPP_CLOUD_TOKEN',
  'HTTP_BEARER',
  'HTTP_BASIC',
  'HTTP_API_KEY',
  'OUTRO',
]);

// Schema esperado de `dados` por tipo. Se faltar campo obrigatorio, rejeita.
const SCHEMA_POR_TIPO = {
  OPENAI_API_KEY: { obrigatorios: ['apiKey'], opcionais: ['organizationId'] },
  ANTHROPIC_API_KEY: { obrigatorios: ['apiKey'], opcionais: [] },
  GEMINI_API_KEY: { obrigatorios: ['apiKey'], opcionais: [] },
  WHATSAPP_CLOUD_TOKEN: { obrigatorios: ['accessToken', 'phoneNumberId'], opcionais: ['businessAccountId'] },
  HTTP_BEARER: { obrigatorios: ['token'], opcionais: [] },
  HTTP_BASIC: { obrigatorios: ['usuario', 'senha'], opcionais: [] },
  HTTP_API_KEY: { obrigatorios: ['headerName', 'key'], opcionais: [] },
  OUTRO: { obrigatorios: [], opcionais: [] },
};

const TAM_MAX_NOME = 120;
const TAM_MAX_DESCRICAO = 500;
const TAM_MAX_VALOR_CAMPO = 8_000;

function validarPayload(tipo, dados) {
  const schema = SCHEMA_POR_TIPO[tipo];
  if (!schema) return { erro: `Tipo invalido: ${tipo}.` };
  if (!dados || typeof dados !== 'object') return { erro: 'dados deve ser objeto.' };
  for (const campo of schema.obrigatorios) {
    const v = dados[campo];
    if (typeof v !== 'string' || !v.trim()) {
      return { erro: `Campo obrigatorio faltando: ${campo}.` };
    }
    if (v.length > TAM_MAX_VALOR_CAMPO) {
      return { erro: `Campo ${campo} excede ${TAM_MAX_VALOR_CAMPO} caracteres.` };
    }
  }
  return { ok: true };
}

function semSegredos(c) {
  // Nunca devolver dadosCifrados/iv/tag pelas rotas
  if (!c) return c;
  // eslint-disable-next-line no-unused-vars
  const { dadosCifrados, iv, tag, ...resto } = c;
  return resto;
}

async function credencialDoTenant(id, usuario) {
  const where = ehAdmin(usuario)
    ? { id }
    : { id, clienteId: usuario.clienteId };
  return prisma.credencial.findFirst({ where });
}

// ==========================================
// META
// ==========================================
roteador.get('/tipos', (req, res) => {
  res.json(
    Array.from(TIPOS_VALIDOS).map((tipo) => ({
      tipo,
      schema: SCHEMA_POR_TIPO[tipo],
    }))
  );
});

// ==========================================
// LISTAR — metadata sem segredos
// ==========================================
roteador.get('/', requerPermissao('CONFIGURACOES', 'visualizar'), async (req, res) => {
  try {
    const where = ehAdmin(req.usuario) ? {} : { clienteId: req.usuario.clienteId };
    const itens = await prisma.credencial.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
    });
    res.json(itens.map(semSegredos));
  } catch (erro) {
    console.error('[credenciais/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar credenciais.' });
  }
});

// ==========================================
// DETALHAR — sem segredos
// ==========================================
roteador.get('/:id', requerPermissao('CONFIGURACOES', 'visualizar'), async (req, res) => {
  try {
    const c = await credencialDoTenant(req.params.id, req.usuario);
    if (!c) return res.status(404).json({ erro: 'Credencial nao encontrada.' });
    res.json(semSegredos(c));
  } catch (erro) {
    console.error('[credenciais/detalhar]', erro);
    res.status(500).json({ erro: 'Erro ao buscar credencial.' });
  }
});

// ==========================================
// CRIAR
// Body: { nome, tipo, descricao?, dados: { ... } }
// ==========================================
roteador.post('/', requerPermissao('CONFIGURACOES', 'editar'), async (req, res) => {
  try {
    if (ehAdmin(req.usuario) || !req.usuario.clienteId) {
      return res.status(403).json({ erro: 'Apenas usuarios do tenant podem criar credenciais.' });
    }

    const { nome, tipo, descricao, dados } = req.body || {};

    if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > TAM_MAX_NOME) {
      return res.status(400).json({ erro: `Nome obrigatorio (2-${TAM_MAX_NOME} chars).` });
    }
    if (!TIPOS_VALIDOS.has(tipo)) {
      return res.status(400).json({ erro: `Tipo invalido. Valores: ${[...TIPOS_VALIDOS].join(', ')}.` });
    }
    if (typeof descricao === 'string' && descricao.length > TAM_MAX_DESCRICAO) {
      return res.status(400).json({ erro: `Descricao excede ${TAM_MAX_DESCRICAO} caracteres.` });
    }

    const payload = normalizarPayload(dados);
    const valid = validarPayload(tipo, payload);
    if (valid.erro) return res.status(400).json({ erro: valid.erro });

    const cifrado = cifrarPayload(req.usuario.clienteId, payload);
    const credencial = await prisma.credencial.create({
      data: {
        clienteId: req.usuario.clienteId,
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
    console.error('[credenciais/criar]', erro);
    res.status(500).json({ erro: 'Erro ao criar credencial.' });
  }
});

// ==========================================
// ATUALIZAR
// Body: { nome?, descricao?, dados? }  (dados regenera ciphertext)
// ==========================================
roteador.put('/:id', requerPermissao('CONFIGURACOES', 'editar'), async (req, res) => {
  try {
    if (ehAdmin(req.usuario)) {
      return res.status(403).json({ erro: 'Apenas usuarios do tenant podem editar credenciais.' });
    }
    const credencial = await credencialDoTenant(req.params.id, req.usuario);
    if (!credencial) return res.status(404).json({ erro: 'Credencial nao encontrada.' });

    const { nome, descricao, dados } = req.body || {};
    const data = {};

    if (nome !== undefined) {
      if (typeof nome !== 'string' || nome.trim().length < 2 || nome.length > TAM_MAX_NOME) {
        return res.status(400).json({ erro: `Nome invalido (2-${TAM_MAX_NOME} chars).` });
      }
      data.nome = nome.trim();
    }
    if (descricao !== undefined) {
      if (descricao !== null && typeof descricao !== 'string') {
        return res.status(400).json({ erro: 'Descricao deve ser texto ou null.' });
      }
      if (typeof descricao === 'string' && descricao.length > TAM_MAX_DESCRICAO) {
        return res.status(400).json({ erro: `Descricao excede ${TAM_MAX_DESCRICAO} caracteres.` });
      }
      data.descricao = descricao ? descricao.trim() : null;
    }
    if (dados !== undefined) {
      const payload = normalizarPayload(dados);
      const valid = validarPayload(credencial.tipo, payload);
      if (valid.erro) return res.status(400).json({ erro: valid.erro });
      const cifrado = cifrarPayload(credencial.clienteId, payload);
      data.dadosCifrados = cifrado.conteudoCifrado;
      data.iv = cifrado.iv;
      data.tag = cifrado.tag;
      data.versaoChave = cifrado.versaoChave;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }

    const atualizada = await prisma.credencial.update({
      where: { id: credencial.id },
      data,
    });
    res.json(semSegredos(atualizada));
  } catch (erro) {
    console.error('[credenciais/atualizar]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar credencial.' });
  }
});

// ==========================================
// EXCLUIR
// ==========================================
roteador.delete('/:id', requerPermissao('CONFIGURACOES', 'excluir'), async (req, res) => {
  try {
    if (ehAdmin(req.usuario)) {
      return res.status(403).json({ erro: 'Apenas usuarios do tenant podem excluir credenciais.' });
    }
    const credencial = await credencialDoTenant(req.params.id, req.usuario);
    if (!credencial) return res.status(404).json({ erro: 'Credencial nao encontrada.' });
    await prisma.credencial.delete({ where: { id: credencial.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[credenciais/excluir]', erro);
    res.status(500).json({ erro: 'Erro ao excluir credencial.' });
  }
});

module.exports = roteador;
