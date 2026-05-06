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

module.exports = {
  aceitarUmaImagem,
  extensaoDeMime,
  TAMANHO_MAX_BYTES,
  MIMES_ACEITOS,
};
