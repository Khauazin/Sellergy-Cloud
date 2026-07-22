// Middleware de cache de resposta (GET), isolado por tenant + usuário.
//
// Uso na rota (depois da autenticacao/permissao, antes do handler):
//   roteador.get('/dashboard', podeVer, cacheResposta('estoque:dashboard', 60), Ctrl.dashboard)
//
// Seguranca:
//  - So cacheia GET e SO quando ha tenant (req.usuario.clienteId). Sem escopo,
//    passa direto (nunca cacheia sem isolamento).
//  - A chave inclui clienteId E usuarioId -> nenhum usuario ve o cache de outro,
//    mesmo dentro do mesmo tenant (relatorios podem variar por escopo do vendedor).
//  - Fail-open: erro de cache nunca quebra o request (cai no handler normal).
//  - So guarda respostas 2xx.

const { chaveTenant, ler, gravar } = require('../utils/cache');

function cacheResposta(namespace, ttlSegundos) {
  return async (req, res, next) => {
    if (req.method !== 'GET' || !req.usuario?.clienteId) return next();

    let chave;
    try {
      // originalUrl = path + querystring (period, filtros...) -> chave por variacao.
      chave = chaveTenant(
        namespace,
        { clienteId: req.usuario.clienteId, usuarioId: req.usuario.id },
        req.originalUrl,
      );
    } catch {
      return next(); // sem chave segura -> nao cacheia
    }

    const cacheado = await ler(chave);
    if (cacheado !== null) {
      res.set('X-Cache', 'HIT');
      return res.json(cacheado);
    }

    // Intercepta res.json pra guardar a resposta quando o handler responder 2xx.
    const jsonOriginal = res.json.bind(res);
    res.json = (corpo) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        gravar(chave, corpo, ttlSegundos); // fire-and-forget, fail-open
        res.set('X-Cache', 'MISS');
      }
      return jsonOriginal(corpo);
    };
    return next();
  };
}

module.exports = { cacheResposta };
