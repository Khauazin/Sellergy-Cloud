// Middleware de upload de imagens. Usa multer em memoria — o handler de cada
// rota e responsavel por enviar pro MinIO via storage/minio.upload.
//
// Limites: 5MB e tipos image/jpeg, image/png, image/webp.
// O middleware ja rejeita arquivos invalidos com 415/413 antes de chegar
// no handler.

const multer = require('multer');

const TAMANHO_MAX_BYTES = 5 * 1024 * 1024;
const MIMES_ACEITOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

const armazenamento = multer.memoryStorage();

const uploaderImagem = multer({
  storage: armazenamento,
  limits: { fileSize: TAMANHO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!MIMES_ACEITOS.has(file.mimetype)) {
      const erro = new Error(`Tipo nao suportado: ${file.mimetype}. Aceitos: ${[...MIMES_ACEITOS].join(', ')}.`);
      erro.code = 'TIPO_INVALIDO';
      return cb(erro);
    }
    cb(null, true);
  },
});

// Wrapper que traduz erros do multer pra respostas amigaveis.
function aceitarUmaImagem(nomeCampo) {
  return (req, res, next) => {
    uploaderImagem.single(nomeCampo)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: `Arquivo excede ${TAMANHO_MAX_BYTES / 1024 / 1024}MB.` });
      }
      if (err.code === 'TIPO_INVALIDO') {
        return res.status(415).json({ erro: err.message });
      }
      console.error('[upload]', err);
      return res.status(400).json({ erro: 'Falha no upload.' });
    });
  };
}

function extensaoDeMime(mime) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

// ==========================================
// Upload de CSV (importacao em massa — ex.: fornecedores)
// ==========================================
// 2MB e extensao .csv obrigatoria. O mimetype de CSV varia muito entre
// navegadores/SO, entao confiamos na extensao + validamos o CONTEUDO depois
// (utils/csvSeguro.js: rejeita binario, limita linhas, valida estrutura).
const TAMANHO_MAX_CSV = 2 * 1024 * 1024;
const MIMES_CSV = new Set([
  'text/csv', 'application/csv', 'application/vnd.ms-excel',
  'text/plain', 'application/octet-stream', '',
]);

const uploaderCsv = multer({
  storage: armazenamento,
  limits: { fileSize: TAMANHO_MAX_CSV, files: 1 },
  fileFilter: (_req, file, cb) => {
    const nome = (file.originalname || '').toLowerCase();
    if (!nome.endsWith('.csv')) {
      const erro = new Error('Envie um arquivo .csv.');
      erro.code = 'TIPO_INVALIDO';
      return cb(erro);
    }
    if (file.mimetype && !MIMES_CSV.has(file.mimetype)) {
      const erro = new Error(`Tipo nao suportado: ${file.mimetype}. Envie um .csv.`);
      erro.code = 'TIPO_INVALIDO';
      return cb(erro);
    }
    cb(null, true);
  },
});

function aceitarUmCsv(nomeCampo) {
  return (req, res, next) => {
    uploaderCsv.single(nomeCampo)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: `Arquivo excede ${TAMANHO_MAX_CSV / 1024 / 1024}MB.` });
      }
      if (err.code === 'TIPO_INVALIDO') {
        return res.status(415).json({ erro: err.message });
      }
      console.error('[upload-csv]', err);
      return res.status(400).json({ erro: 'Falha no upload do CSV.' });
    });
  };
}

// ==========================================
// Upload de XML (import de NF-e — entrada de nota)
// ==========================================
// 4MB e extensao .xml. O CONTEUDO e validado depois (utils/nfeSeguro.js: recusa
// binario, DTD/entidades (anti-XXE), instrucoes de processamento, e nunca expande
// entidade). Confiamos na extensao + validamos o conteudo.
const TAMANHO_MAX_XML = 4 * 1024 * 1024;
const MIMES_XML = new Set([
  'text/xml', 'application/xml', 'application/octet-stream', 'text/plain', '',
]);

const uploaderXml = multer({
  storage: armazenamento,
  limits: { fileSize: TAMANHO_MAX_XML, files: 1 },
  fileFilter: (_req, file, cb) => {
    const nome = (file.originalname || '').toLowerCase();
    if (!nome.endsWith('.xml')) {
      const erro = new Error('Envie o XML da NF-e (.xml).');
      erro.code = 'TIPO_INVALIDO';
      return cb(erro);
    }
    if (file.mimetype && !MIMES_XML.has(file.mimetype)) {
      const erro = new Error(`Tipo nao suportado: ${file.mimetype}. Envie um .xml.`);
      erro.code = 'TIPO_INVALIDO';
      return cb(erro);
    }
    cb(null, true);
  },
});

function aceitarUmXml(nomeCampo) {
  return (req, res, next) => {
    uploaderXml.single(nomeCampo)(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: `Arquivo excede ${TAMANHO_MAX_XML / 1024 / 1024}MB.` });
      }
      if (err.code === 'TIPO_INVALIDO') {
        return res.status(415).json({ erro: err.message });
      }
      console.error('[upload-xml]', err);
      return res.status(400).json({ erro: 'Falha no upload do XML.' });
    });
  };
}

module.exports = {
  aceitarUmaImagem,
  aceitarUmCsv,
  aceitarUmXml,
  extensaoDeMime,
  TAMANHO_MAX_BYTES,
  MIMES_ACEITOS,
  TAMANHO_MAX_CSV,
  TAMANHO_MAX_XML,
};
