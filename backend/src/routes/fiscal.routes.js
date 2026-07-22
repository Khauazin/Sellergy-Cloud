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
const {
  soDigitos, validarCnpj, validarDocumento, validarNcm, validarCfop, validarCest,
  validarUf, resolverModoFiscal, conteudoCertificadoProibido, validarProntidaoProducao,
} = require('../utils/validacaoFiscal');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('FISCAL'));
roteador.use(requerPapelPrivilegiado);

const TIPOS = ['NFCE', 'NFSE'];
const AMBIENTES = ['HOMOLOGACAO', 'PRODUCAO'];

// Campos do emitente (identidade da empresa na nota). Persistidos e devolvidos
// junto da config; opcionais (exigidos so na emissao real, Fase 4).
const CAMPOS_EMITENTE = [
  'inscricaoMunicipal', 'razaoSocial', 'nomeFantasia', 'cnae',
  'emailEmitente', 'telefoneEmitente',
  'logradouro', 'numero', 'complemento', 'bairro', 'municipio', 'uf', 'cep',
];

// Config (sem o conteudo da credencial / certificado).
const CAMPOS_CONFIG = {
  provedor: true, credencialId: true, regime: true, cnpj: true, inscricao: true,
  csc: true, serie: true, ambiente: true, ativo: true, atualizadoEm: true,
  ...Object.fromEntries(CAMPOS_EMITENTE.map((k) => [k, true])),
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
  // 'live' so com opt-in deliberado (FISCAL_LIVE=true) + ambiente PRODUCAO.
  // Default: 'fixture' (nunca bate no SEFAZ por acidente).
  const emissor = criarProvedor(config.provedor, { credencial, config, ambiente, modo: resolverModoFiscal(config) });
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

    // SEGURANCA: o certificado digital NUNCA fica conosco — vai pro provedor.
    // Recusa qualquer tentativa de mandar o conteudo/senha do certificado.
    const chaveCert = conteudoCertificadoProibido(req.body || {});
    if (chaveCert) {
      return res.status(400).json({
        erro: 'Por seguranca, o certificado digital nao fica armazenado aqui — ele e enviado direto ao provedor (Focus NFe / Nuvem Fiscal). Informe apenas a referencia, nunca o arquivo ou a senha.',
      });
    }

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
    if (cnpj && !validarCnpj(cnpj)) {
      return res.status(400).json({ erro: 'CNPJ do emitente invalido.' });
    }
    if (req.body?.uf && !validarUf(req.body.uf)) {
      return res.status(400).json({ erro: 'UF invalida.' });
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
      // Dados do emitente (cada um string opcional; vazio vira null).
      ...Object.fromEntries(
        CAMPOS_EMITENTE.map((k) => [k, String(req.body?.[k] ?? '').trim().slice(0, 200) || null]),
      ),
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
    const { tipo, vendaId, valor, descricao, payload, itens, baseValor } = req.body || {};

    const t = String(tipo || '').toUpperCase();
    if (!TIPOS.includes(t)) {
      return res.status(400).json({ erro: `Tipo invalido. Use: ${TIPOS.join(', ')}.` });
    }

    // Dois modos: por PRODUTOS (valor travado do catalogo, com toggle venda/custo)
    // ou por VALOR avulso (compat). Quando ha itens, o valor vem deles.
    let valorNum;
    let base = null;
    let itensData = [];
    if (Array.isArray(itens) && itens.length > 0) {
      base = String(baseValor || 'VENDA').toUpperCase() === 'CUSTO' ? 'CUSTO' : 'VENDA';
      const norm = [];
      for (let i = 0; i < itens.length; i++) {
        const variacaoId = itens[i]?.variacaoId;
        const quantidade = Number(itens[i]?.quantidade);
        if (!variacaoId || typeof variacaoId !== 'string') {
          return res.status(400).json({ erro: `Item ${i + 1}: produto invalido.` });
        }
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          return res.status(400).json({ erro: `Item ${i + 1}: quantidade invalida.` });
        }
        // Campos fiscais (opcionais em fixture; obrigatorios no gate de producao).
        const ncm = soDigitos(itens[i]?.ncm);
        const cfop = soDigitos(itens[i]?.cfop);
        const cest = soDigitos(itens[i]?.cest);
        if (!validarNcm(ncm)) return res.status(400).json({ erro: `Item ${i + 1}: NCM deve ter 8 digitos.` });
        if (!validarCfop(cfop)) return res.status(400).json({ erro: `Item ${i + 1}: CFOP deve ter 4 digitos.` });
        if (!validarCest(cest)) return res.status(400).json({ erro: `Item ${i + 1}: CEST deve ter 7 digitos.` });
        norm.push({ variacaoId, quantidade, ncm, cfop, cest });
      }
      const ids = [...new Set(norm.map((n) => n.variacaoId))];
      const variacoes = await prisma.variacaoProduto.findMany({
        where: { id: { in: ids }, produto: { clienteId } },
        include: { produto: { select: { id: true, nome: true } } },
      });
      const mapa = new Map(variacoes.map((v) => [v.id, v]));
      for (const n of norm) {
        const v = mapa.get(n.variacaoId);
        if (!v) return res.status(404).json({ erro: 'Um dos produtos nao foi encontrado.' });
        // valorUnitario TRAVADO do catalogo conforme a base escolhida.
        const unit = base === 'CUSTO' ? Number(v.precoCusto || 0) : Number(v.preco || 0);
        const ehPadrao = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
        itensData.push({
          produtoId: v.produto.id,
          variacaoId: v.id,
          descricao: ehPadrao ? v.produto.nome : `${v.produto.nome} — ${v.nome}`,
          quantidade: n.quantidade,
          valorUnitario: unit,
          valorTotal: Math.round(unit * n.quantidade * 100) / 100,
          ncm: n.ncm || null,
          cfop: n.cfop || null,
          cest: n.cest || null,
        });
      }
      valorNum = Math.round(itensData.reduce((s, it) => s + it.valorTotal, 0) * 100) / 100;
      if (valorNum <= 0) {
        return res.status(400).json({ erro: 'O total da nota ficou zero — confira preco/custo dos itens.' });
      }
    } else {
      valorNum = Number(valor);
      if (!Number.isFinite(valorNum) || valorNum <= 0) {
        return res.status(400).json({ erro: 'Valor invalido.' });
      }
    }

    // Destinatario (validado quando informado).
    const dest = (req.body && req.body.destinatario) || {};
    const destDoc = soDigitos(dest.documento);
    if (destDoc && !validarDocumento(destDoc)) {
      return res.status(400).json({ erro: 'Documento do destinatario (CNPJ/CPF) invalido.' });
    }
    if (dest.uf && !validarUf(dest.uf)) {
      return res.status(400).json({ erro: 'UF do destinatario invalida.' });
    }
    const destData = {
      destNome: dest.nome ? String(dest.nome).slice(0, 120) : null,
      destDocumento: destDoc || null,
      destEmail: dest.email ? String(dest.email).slice(0, 160) : null,
      destUf: dest.uf ? String(dest.uf).toUpperCase().slice(0, 2) : null,
      destMunicipio: dest.municipio ? String(dest.municipio).slice(0, 120) : null,
    };

    const { config, emissor } = await emissorDoTenant(clienteId);

    // GATE de PRODUCAO: antes de emitir DE VERDADE, exige emitente/certificado/
    // credencial completos + NCM/CFOP por item + destinatario; senao bloqueia
    // (nada e enviado). Em fixture, nada disso e exigido — facilita o teste.
    if (resolverModoFiscal(config) === 'live') {
      const falta = validarProntidaoProducao(config, itensData);
      if (!destData.destNome || !destData.destDocumento) falta.push('destinatario (nome e CNPJ/CPF)');
      if (falta.length) {
        return res.status(422).json({ erro: `Emissao em producao bloqueada — falta: ${falta.join('; ')}.` });
      }
    }

    // Cria o documento PENDENTE (+ itens); o id vira a refExterna (idempotencia).
    const doc = await prisma.documentoFiscal.create({
      data: {
        clienteId,
        vendaId: vendaId || null,
        tipo: t,
        status: 'PENDENTE',
        provedor: config.provedor,
        baseValor: base,
        valorTotal: valorNum,
        ...destData,
        ...(itensData.length ? { itens: { create: itensData } } : {}),
      },
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
      select: {
        ...CAMPOS_DOCUMENTO,
        itens: {
          select: {
            id: true, descricao: true, quantidade: true,
            valorUnitario: true, valorTotal: true, ncm: true, cfop: true, cest: true,
          },
        },
      },
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
