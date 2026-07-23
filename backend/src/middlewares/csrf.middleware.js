const crypto = require('crypto');
const { NOME_SESSAO, NOME_CSRF, lerCookie } = require('../utils/sessaoCookie');

// Defesa contra CSRF (falsificacao de requisicao entre sites).
//
// Com a sessao em cookie, o navegador anexa a credencial sozinho — inclusive
// quando quem dispara a requisicao e um site malicioso que a vitima abriu em
// outra aba. Para bloquear isso exigimos um segredo que so o nosso front conhece:
// ele chega pelo corpo de /login e /perfil, fica em memoria no front e volta no
// cabecalho X-CSRF-Token. O site atacante ate consegue disparar a requisicao com
// o cookie, mas nao consegue LER a resposta do /perfil (bloqueio de origem
// cruzada), entao nunca descobre o valor a colocar no cabecalho.
//
// Registrado globalmente de proposito: se dependesse de cada rota lembrar de
// plugar, uma rota nova nasceria desprotegida.

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Isencoes — cada uma justificada, nao ha isencao "por conveniencia":
// - /webhooks: o chamador e o provedor externo (Meta, PSP). Nao existe cookie
//   envolvido e a autenticidade vem da assinatura HMAC conferida no handler.
// - login/registrar: ainda nao ha sessao para proteger.
// - logout: encerrar a sessao a forca nao causa dano, e travar aqui deixaria o
//   usuario preso na sessao caso o segredo se perdesse.
const ISENTOS = [
  /^\/webhooks(\/|$)/,
  /^\/autenticacao\/(login|registrar|logout)$/,
];

function segredosConferem(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  // Comprimento e fixo (64 hex), entao a checagem previa nao vaza informacao —
  // ela existe porque timingSafeEqual lanca com tamanhos diferentes.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const middlewareCsrf = (req, res, next) => {
  // Metodos que nao alteram estado nao precisam da checagem.
  if (METODOS_SEGUROS.has(req.method)) return next();

  const caminho = (req.originalUrl || req.url || '').split('?')[0];
  if (ISENTOS.some((padrao) => padrao.test(caminho))) return next();

  // Sem cookie de sessao nao ha o que ser falsificado: a requisicao tera de se
  // autenticar por Authorization, cabecalho que o navegador jamais anexa
  // sozinho em requisicao originada de outro site.
  if (!lerCookie(req, NOME_SESSAO)) return next();

  const doCookie = lerCookie(req, NOME_CSRF);
  const doCabecalho = req.get('x-csrf-token');

  if (!doCookie || !doCabecalho || !segredosConferem(doCookie, doCabecalho)) {
    // Registra o evento sem nunca imprimir os segredos.
    console.warn('[csrf] bloqueado', req.method, caminho, 'ip=', req.ip);
    return res.status(403).json({
      erro: 'Nao foi possivel validar a origem da requisicao. Atualize a pagina e tente de novo.',
    });
  }

  return next();
};

module.exports = middlewareCsrf;
