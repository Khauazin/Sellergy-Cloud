// Fiscal — Frente 3. Fiacao sobre a camada de adapters (adapters/fiscal):
// config do emissor por tenant + emissao/consulta de DocumentoFiscal.
//
// Emissao e ASSINCRONA no provedor: emitir cria o documento em PROCESSANDO; o
// status final (EMITIDA/ERRO) vem por sincronizacao (consultarStatus). Uma fila
// dedicada com retry automatico e o proximo passo (SEAM) — por ora a
// sincronizacao e sob demanda, e tudo roda em modo 'fixture' (nao bate na rede).
//
// Gating: modulo FISCAL + papel privilegiado (dono/admin) — nota fiscal e
// sensivel; fora da matriz de colaborador por enquanto.
// Ref: docs/erp-arquitetura-e-operacao.md §5. Models: DocumentoFiscal / ConfiguracaoFiscal.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPapelPrivilegiado,
} = require('../middlewares/permissoes.middleware');
const { carregarCredencialDecifrada } = require('../credenciais');
const {
  criarProvedor,
  PROVEDORES,
  TIPO_CREDENCIAL_POR_PROVEDOR,
} = require('../adapters/fiscal');
const { aplicarDocumento, CAMPOS_DOCUMENTO } = require('../services/documentoFiscal');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('FISCAL'));
roteador.use(requerPapelPrivilegiado);

const TIPOS = ['NFCE', 'NFSE'];
const AMBIENTES = ['HOMOLOGACAO', 'PRODUCAO'];

// Config (sem o conteudo da credencial / certificado).
const CAMPOS_CONFIG = {
  provedor: true, credencialId: true, regime: true, cnpj: true, inscricao: true,
  csc: true, serie: true, ambiente: true, ativo: true, atualizadoEm: true,
};

// Monta o emissor do tenant a partir da config + credencial cifrada.
// modo 'fixture' nesta fase — a Fase 4 troca pra 'live'.
async function emissorDoTenant(clienteId) {
  const config = await prisma.configuracaoFiscal.findUnique({ where: { clienteId } });
  if (!config || !config.ativo) {
    throw Object.assign(new Error('Fiscal nao configurado ou inativo para este tenant.'), { status: 400 });
  }
  const credencial = await carregarCredencialDecifrada({ credencialId: config.credencialId, clienteId });
  const ambiente = config.ambiente === 'PRODUCAO' ? 'producao' : 'homologacao';
  const emissor = criarProvedor(config.provedor, { credencial, config, ambiente, modo: 'fixture' });
  return { config, emissor };
}

// --- Configuracao fiscal (1 por tenant) ---

// GET /fiscal/config
roteador.get('/config', async (req, res) => {
  try {
    const config = await prisma.configuracaoFiscal.findUnique({
      where: { clienteId: req.usuario.clienteId },
      select: CAMPOS_CONFIG,
    });
    res.json(config || null);
  } catch (e) {
    console.error('[fiscal/config get]', e);
    res.status(500).json({ erro: 'Erro ao carregar configuracao fiscal.' });
  }
});

// PUT /fiscal/config -> escolhe emissor + dados do emissor + credencial.
roteador.put('/config', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const {
      provedor, credencialId, regime, cnpj, inscricao,
      certificadoRef, csc, serie, ambiente, ativo,
    } = req.body || {};

    if (!PROVEDORES.includes(provedor)) {
      return res.status(400).json({ erro: `Emissor invalido. Use: ${PROVEDORES.join(', ')}.` });
    }
    const amb = ambiente === undefined ? 'HOMOLOGACAO' : String(ambiente).toUpperCase();
    if (!AMBIENTES.includes(amb)) {
      return res.status(400).json({ erro: `Ambiente invalido. Use: ${AMBIENTES.join(', ')}.` });
    }
    if (credencialId) {
      const cred = await prisma.credencial.findFirst({
        where: { id: credencialId, clienteId }, select: { tipo: true },
      });
      if (!cred) return res.status(400).json({ erro: 'Credencial nao encontrada para este tenant.' });
      const tipoEsperado = TIPO_CREDENCIAL_POR_PROVEDOR[provedor];
      if (cred.tipo !== tipoEsperado) {
        return res.status(400).json({ erro: `A credencial precisa ser do tipo ${tipoEsperado} para ${provedor}.` });
      }
    }

    const dados = {
      provedor,
      credencialId: credencialId || null,
      regime: regime || null,
      cnpj: cnpj || null,
      inscricao: inscricao || null,
      certificadoRef: certificadoRef || null,
      csc: csc || null,
      serie: serie || null,
      ambiente: amb,
      ativo: ativo === undefined ? true : ativo === true,
    };
    const config = await prisma.configuracaoFiscal.upsert({
      where: { clienteId },
      create: { clienteId, ...dados },
      update: dados,
      select: CAMPOS_CONFIG,
    });
    res.json(config);
  } catch (e) {
    console.error('[fiscal/config put]', e);
    res.status(500).json({ erro: 'Erro ao salvar configuracao fiscal.' });
  }
});

// --- Documentos ---

// GET /fiscal/documentos?status=EMITIDA
roteador.get('/documentos', async (req, res) => {
  try {
    const where = { clienteId: req.usuario.clienteId };
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    const docs = await prisma.documentoFiscal.findMany({
      where, select: CAMPOS_DOCUMENTO, orderBy: { criadoEm: 'desc' }, take: 100,
    });
    res.json(docs);
  } catch (e) {
    console.error('[fiscal/documentos list]', e);
    res.status(500).json({ erro: 'Erro ao listar documentos fiscais.' });
  }
});

// POST /fiscal/documentos -> emite NFC-e ou NFS-e.
// Body: { tipo, vendaId?, valor, descricao, payload? }
roteador.post('/documentos', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const { tipo, vendaId, valor, descricao, payload } = req.body || {};

    const t = String(tipo || '').toUpperCase();
    if (!TIPOS.includes(t)) {
      return res.status(400).json({ erro: `Tipo invalido. Use: ${TIPOS.join(', ')}.` });
    }
    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return res.status(400).json({ erro: 'Valor invalido.' });
    }

    const { config, emissor } = await emissorDoTenant(clienteId);

    // Cria o documento PENDENTE; o id vira a refExterna (idempotencia no emissor).
    const doc = await prisma.documentoFiscal.create({
      data: { clienteId, vendaId: vendaId || null, tipo: t, status: 'PENDENTE', provedor: config.provedor },
    });

    let dto;
    try {
      const params = { valor: valorNum, descricao: descricao || `Documento ${doc.id}`, refExterna: doc.id, payload };
      dto = t === 'NFCE' ? await emissor.emitirNFCe(params) : await emissor.emitirNFSe(params);
    } catch (errEmissor) {
      const comErro = await prisma.documentoFiscal.update({
        where: { id: doc.id },
        data: { status: 'ERRO', mensagemErro: errEmissor.message?.slice(0, 500) || 'Falha na emissao.' },
        select: CAMPOS_DOCUMENTO,
      });
      return res.status(502).json(comErro);
    }

    const atualizado = await aplicarDocumento(doc, dto);
    res.status(201).json(atualizado);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error('[fiscal/documentos emit]', e);
    res.status(500).json({ erro: 'Erro ao emitir documento fiscal.' });
  }
});

// GET /fiscal/documentos/:id
roteador.get('/documentos/:id', async (req, res) => {
  try {
    const doc = await prisma.documentoFiscal.findFirst({
      where: { id: req.params.id, clienteId: req.usuario.clienteId },
      select: CAMPOS_DOCUMENTO,
    });
    if (!doc) return res.status(404).json({ erro: 'Documento nao encontrado.' });
    res.json(doc);
  } catch (e) {
    console.error('[fiscal/documentos get]', e);
    res.status(500).json({ erro: 'Erro ao carregar documento.' });
  }
});

// POST /fiscal/documentos/:id/sincronizar -> consulta o status no emissor.
roteador.post('/documentos/:id/sincronizar', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const doc = await prisma.documentoFiscal.findFirst({ where: { id: req.params.id, clienteId } });
    if (!doc) return res.status(404).json({ erro: 'Documento nao encontrado.' });
    if (!doc.provedorDocId) return res.status(400).json({ erro: 'Documento sem id no emissor — nada a sincronizar.' });

    const { emissor } = await emissorDoTenant(clienteId);
    const dto = await emissor.consultarStatus(doc.provedorDocId);
    const atualizado = await aplicarDocumento(doc, dto);
    res.json(atualizado);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error('[fiscal/documentos sync]', e);
    res.status(500).json({ erro: 'Erro ao sincronizar documento.' });
  }
});

// POST /fiscal/documentos/:id/cancelar -> cancela no emissor.
roteador.post('/documentos/:id/cancelar', async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const { motivo } = req.body || {};
    const doc = await prisma.documentoFiscal.findFirst({ where: { id: req.params.id, clienteId } });
    if (!doc) return res.status(404).json({ erro: 'Documento nao encontrado.' });
    if (!doc.provedorDocId || doc.status !== 'EMITIDA') {
      return res.status(400).json({ erro: 'So documentos EMITIDOS podem ser cancelados.' });
    }

    const { emissor } = await emissorDoTenant(clienteId);
    const r = await emissor.cancelar(doc.provedorDocId, motivo || 'Cancelamento solicitado.');
    const atualizado = await aplicarDocumento(doc, { provedorDocId: doc.provedorDocId, status: r.status });
    res.json(atualizado);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error('[fiscal/documentos cancel]', e);
    res.status(500).json({ erro: 'Erro ao cancelar documento.' });
  }
});

module.exports = roteador;
