const test = require('node:test');
const assert = require('node:assert');

const middlewareCsrf = require('./csrf.middleware');
const { NOME_SESSAO, NOME_CSRF, gerarCsrf } = require('../utils/sessaoCookie');

// Requisicao falsa no formato minimo que o middleware consome.
function reqFalso({ metodo = 'POST', url = '/vendas', cookie, header }) {
  return {
    method: metodo,
    originalUrl: url,
    url,
    ip: '10.0.0.1',
    headers: cookie ? { cookie } : {},
    get(nome) {
      return nome.toLowerCase() === 'x-csrf-token' ? header : undefined;
    },
  };
}

function resFalso() {
  return {
    codigo: null,
    corpo: null,
    status(c) { this.codigo = c; return this; },
    json(b) { this.corpo = b; return this; },
  };
}

// Executa o middleware e informa se ele deixou passar.
function executar(req) {
  const res = resFalso();
  let passou = false;
  middlewareCsrf(req, res, () => { passou = true; });
  return { passou, res };
}

const csrf = gerarCsrf();
const cookieCompleto = `${NOME_SESSAO}=tok.en.jwt; ${NOME_CSRF}=${csrf}`;

test('deixa passar metodos que nao alteram dados', () => {
  const { passou } = executar(reqFalso({ metodo: 'GET', cookie: cookieCompleto }));
  assert.strictEqual(passou, true);
});

test('bloqueia escrita com cookie de sessao e sem o cabecalho', () => {
  const { passou, res } = executar(reqFalso({ cookie: cookieCompleto }));
  assert.strictEqual(passou, false);
  assert.strictEqual(res.codigo, 403);
});

test('bloqueia escrita quando o cabecalho nao bate com o cookie', () => {
  const { passou, res } = executar(reqFalso({ cookie: cookieCompleto, header: gerarCsrf() }));
  assert.strictEqual(passou, false);
  assert.strictEqual(res.codigo, 403);
});

test('bloqueia cabecalho de tamanho diferente sem estourar excecao', () => {
  // timingSafeEqual lanca com tamanhos distintos; a checagem previa evita que um
  // valor curto derrube o processo em vez de virar 403.
  const { passou, res } = executar(reqFalso({ cookie: cookieCompleto, header: 'curto' }));
  assert.strictEqual(passou, false);
  assert.strictEqual(res.codigo, 403);
});

test('libera escrita quando cabecalho e cookie coincidem', () => {
  const { passou } = executar(reqFalso({ cookie: cookieCompleto, header: csrf }));
  assert.strictEqual(passou, true);
});

test('libera escrita sem cookie de sessao (cliente que usa Authorization)', () => {
  // Sem cookie nao ha o que falsificar: o navegador nunca anexa Authorization
  // sozinho numa requisicao disparada por outro site.
  const { passou } = executar(reqFalso({ cookie: undefined }));
  assert.strictEqual(passou, true);
});

test('bloqueia quando falta so o cookie de csrf', () => {
  const { passou, res } = executar(reqFalso({ cookie: `${NOME_SESSAO}=tok.en.jwt`, header: csrf }));
  assert.strictEqual(passou, false);
  assert.strictEqual(res.codigo, 403);
});

test('isenta webhooks externos, que se autenticam por assinatura', () => {
  const { passou } = executar(reqFalso({ url: '/webhooks/pagamento', cookie: cookieCompleto }));
  assert.strictEqual(passou, true);
});

test('isenta login, registro e logout', () => {
  for (const rota of ['/autenticacao/login', '/autenticacao/registrar', '/autenticacao/logout']) {
    const { passou } = executar(reqFalso({ url: rota, cookie: cookieCompleto }));
    assert.strictEqual(passou, true, `deveria liberar ${rota}`);
  }
});

test('a isencao nao vaza para rotas de nome parecido', () => {
  // '/webhooksfalso' e '/autenticacao/loginX' nao podem herdar a isencao.
  for (const rota of ['/webhooksfalso', '/autenticacao/loginX', '/autenticacao/logout/tudo']) {
    const { passou, res } = executar(reqFalso({ url: rota, cookie: cookieCompleto }));
    assert.strictEqual(passou, false, `deveria bloquear ${rota}`);
    assert.strictEqual(res.codigo, 403);
  }
});

test('a query string nao serve para burlar a checagem de rota', () => {
  const { passou, res } = executar(reqFalso({ url: '/vendas?x=/autenticacao/login', cookie: cookieCompleto }));
  assert.strictEqual(passou, false);
  assert.strictEqual(res.codigo, 403);
});
