const crypto = require('crypto');

// Sessao em cookie httpOnly — o token JWT nunca fica acessivel ao JavaScript do
// navegador. Isso e o que impede um XSS de roubar a sessao: mesmo executando
// script na pagina, o atacante nao consegue ler o cookie.
//
// Como o cookie e enviado automaticamente pelo navegador, entra o risco de CSRF.
// A defesa aqui e um par: cookie httpOnly com o segredo + o mesmo valor
// devolvido no CORPO das respostas de login/perfil. O front guarda esse valor em
// memoria e reenvia no cabecalho X-CSRF-Token. Um site atacante consegue fazer o
// navegador mandar o cookie, mas nao consegue LER o corpo da resposta (bloqueio
// de origem cruzada), entao nunca descobre o valor do cabecalho.
//
// Nao usamos o padrao classico de cookie legivel pelo JS porque front e API vivem
// em dominios diferentes (Vercel x tunel/dominio da API) e `document.cookie` so
// enxerga cookies do proprio dominio.

const NOME_SESSAO = 'sellergy_sessao';
const NOME_CSRF = 'sellergy_csrf';

// Espelha o prazo do JWT emitido em routes/auth.routes.js. Se um mudar, o outro
// precisa mudar junto, senao o cookie sobrevive ao token (ou o contrario).
const DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

// Front e API em dominios distintos exigem SameSite=None + Secure, senao o
// navegador simplesmente nao envia o cookie. Num cenario de dominio unico da pra
// apertar para 'lax' (defesa extra contra CSRF) so mexendo no ambiente.
const SAMESITE = (process.env.COOKIE_SAMESITE || 'none').toLowerCase();
const SECURE = process.env.COOKIE_SECURE !== 'false';

function opcoesBase() {
  return {
    secure: SECURE,
    sameSite: SAMESITE,
    path: '/',
    ...(process.env.COOKIE_DOMINIO ? { domain: process.env.COOKIE_DOMINIO } : {}),
  };
}

/**
 * Le um cookie do cabecalho da requisicao. Evita a dependencia cookie-parser —
 * precisamos de um unico valor e assim nao ha pacote novo para instalar.
 */
function lerCookie(req, nome) {
  const bruto = req.headers?.cookie;
  if (!bruto) return null;

  for (const parte of bruto.split(';')) {
    // O valor pode conter '=', entao corta so no primeiro separador.
    const corte = parte.indexOf('=');
    if (corte < 0) continue;
    if (parte.slice(0, corte).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(corte + 1).trim()) || null;
    } catch {
      return null; // valor malformado: trata como ausente
    }
  }
  return null;
}

function gerarCsrf() {
  return crypto.randomBytes(32).toString('hex');
}

const FORMATO_CSRF = /^[a-f0-9]{64}$/;

/**
 * Grava a sessao (token + segredo de CSRF) e devolve o valor de CSRF que deve
 * ser enviado no corpo da resposta para o front guardar em memoria.
 */
function definirSessao(res, token) {
  const csrf = gerarCsrf();
  res.cookie(NOME_SESSAO, token, { ...opcoesBase(), httpOnly: true, maxAge: DURACAO_MS });
  res.cookie(NOME_CSRF, csrf, { ...opcoesBase(), httpOnly: true, maxAge: DURACAO_MS });
  return csrf;
}

/**
 * Devolve o CSRF da sessao atual; cria um se ainda nao existir (sessao aberta
 * antes desta versao, ou cookie expirado antes do token).
 */
function garantirCsrf(req, res) {
  const atual = lerCookie(req, NOME_CSRF);
  if (atual && FORMATO_CSRF.test(atual)) return atual;

  const novo = gerarCsrf();
  res.cookie(NOME_CSRF, novo, { ...opcoesBase(), httpOnly: true, maxAge: DURACAO_MS });
  return novo;
}

/**
 * Encerra a sessao. Os atributos precisam bater com os da gravacao, senao o
 * navegador ignora a remocao e o cookie continua vivo.
 */
function limparSessao(res) {
  const opcoes = { ...opcoesBase(), httpOnly: true };
  res.clearCookie(NOME_SESSAO, opcoes);
  res.clearCookie(NOME_CSRF, opcoes);
}

module.exports = {
  NOME_SESSAO,
  NOME_CSRF,
  DURACAO_MS,
  lerCookie,
  gerarCsrf,
  definirSessao,
  garantirCsrf,
  limparSessao,
};
