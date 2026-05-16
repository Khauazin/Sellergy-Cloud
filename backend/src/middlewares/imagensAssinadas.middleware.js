// Middleware global que intercepta `res.json` e troca toda string `imagemUrl`
// pela URL pre-signed (URL assinada com expiracao). Garante que NENHUM
// retorno da API exponha a URL canonica do MinIO — todas as imagens que
// chegam no front sao temporarias e validas so via assinatura do backend.
//
// Plugado UMA VEZ no index.js antes das rotas. Cobertura automatica:
// controllers atuais e futuros nao precisam saber dessa logica.
//
// Comportamento defensivo: se a transformacao falhar (MinIO down, key invalida),
// loga e devolve o body original — nao quebra a resposta.

const { transformarUrlsAssinadas } = require('../storage/minio');

module.exports = function imagensAssinadasMiddleware(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Promise — aguarda a transformacao antes de mandar.
    Promise.resolve()
      .then(() => transformarUrlsAssinadas(body))
      .then((transformado) => originalJson(transformado))
      .catch((e) => {
        console.error('[imagensAssinadas] falha na transformacao:', e?.message || e);
        originalJson(body); // fallback — devolve sem mexer
      });

    // res.json normalmente retorna `res`. Mantemos pra preservar a cadeia
    // (raro alguem encadear, mas evita comportamento estranho).
    return res;
  };

  next();
};
