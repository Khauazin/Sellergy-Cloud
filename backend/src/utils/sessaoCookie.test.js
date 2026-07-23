const test = require('node:test');
const assert = require('node:assert');

const {
  NOME_SESSAO,
  NOME_CSRF,
  lerCookie,
  gerarCsrf,
  definirSessao,
  garantirCsrf,
  limparSessao,
} = require('./sessaoCookie');

// Resposta falsa que apenas registra o que seria gravado no navegador.
function resFalso() {
  return {
    gravados: [],
    apagados: [],
    cookie(nome, valor, opcoes) { this.gravados.push({ nome, valor, opcoes }); },
    clearCookie(nome, opcoes) { this.apagados.push({ nome, opcoes }); },
  };
}

const req = (cookie) => ({ headers: cookie === undefined ? {} : { cookie } });

test('lerCookie encontra o valor entre varios cookies', () => {
  const cabecalho = `outro=1; ${NOME_SESSAO}=abc.def.ghi; mais=2`;
  assert.strictEqual(lerCookie(req(cabecalho), NOME_SESSAO), 'abc.def.ghi');
});

test('lerCookie devolve null quando o cookie nao existe', () => {
  assert.strictEqual(lerCookie(req('outro=1'), NOME_SESSAO), null);
  assert.strictEqual(lerCookie(req(), NOME_SESSAO), null);
  assert.strictEqual(lerCookie({}, NOME_SESSAO), null);
});

test('lerCookie nao confunde nome parecido com o nome exato', () => {
  // Sem comparacao exata, um cookie plantado por subdominio poderia se passar
  // pelo cookie de sessao.
  const cabecalho = `x${NOME_SESSAO}=falso; ${NOME_SESSAO}_backup=falso2`;
  assert.strictEqual(lerCookie(req(cabecalho), NOME_SESSAO), null);
});

test('lerCookie preserva valor que contem sinal de igual', () => {
  const cabecalho = `${NOME_SESSAO}=aa=bb=cc`;
  assert.strictEqual(lerCookie(req(cabecalho), NOME_SESSAO), 'aa=bb=cc');
});

test('lerCookie trata valor malformado como ausente', () => {
  // '%E0%A4%A' e uma sequencia percentual invalida: decodeURIComponent lanca.
  assert.strictEqual(lerCookie(req(`${NOME_SESSAO}=%E0%A4%A`), NOME_SESSAO), null);
});

test('gerarCsrf produz 64 hex e nao repete', () => {
  const a = gerarCsrf();
  const b = gerarCsrf();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notStrictEqual(a, b);
});

test('definirSessao grava os dois cookies como httpOnly e devolve o csrf', () => {
  const res = resFalso();
  const csrf = definirSessao(res, 'token.jwt.aqui');

  assert.match(csrf, /^[a-f0-9]{64}$/);
  assert.strictEqual(res.gravados.length, 2);

  const sessao = res.gravados.find((c) => c.nome === NOME_SESSAO);
  assert.strictEqual(sessao.valor, 'token.jwt.aqui');
  // httpOnly e o que impede um XSS de ler a sessao — se cair, a protecao some.
  assert.strictEqual(sessao.opcoes.httpOnly, true);
  assert.strictEqual(sessao.opcoes.secure, true);
  assert.strictEqual(sessao.opcoes.sameSite, 'none');

  const cookieCsrf = res.gravados.find((c) => c.nome === NOME_CSRF);
  assert.strictEqual(cookieCsrf.valor, csrf);
  assert.strictEqual(cookieCsrf.opcoes.httpOnly, true);
});

test('garantirCsrf reaproveita o valor existente e nao regrava', () => {
  const existente = gerarCsrf();
  const res = resFalso();
  const devolvido = garantirCsrf(req(`${NOME_CSRF}=${existente}`), res);

  assert.strictEqual(devolvido, existente);
  assert.strictEqual(res.gravados.length, 0);
});

test('garantirCsrf cria um novo quando o valor esta ausente ou fora do formato', () => {
  const semCookie = resFalso();
  const novo = garantirCsrf(req(), semCookie);
  assert.match(novo, /^[a-f0-9]{64}$/);
  assert.strictEqual(semCookie.gravados.length, 1);

  const adulterado = resFalso();
  const trocado = garantirCsrf(req(`${NOME_CSRF}=nao-e-hex`), adulterado);
  assert.match(trocado, /^[a-f0-9]{64}$/);
  assert.strictEqual(adulterado.gravados.length, 1);
});

test('limparSessao apaga os dois cookies com os mesmos atributos', () => {
  const res = resFalso();
  limparSessao(res);

  const nomes = res.apagados.map((c) => c.nome).sort();
  assert.deepStrictEqual(nomes, [NOME_CSRF, NOME_SESSAO].sort());
  // Atributos diferentes dos usados na gravacao fazem o navegador ignorar a
  // remocao — o usuario clicaria em sair e continuaria logado.
  for (const apagado of res.apagados) {
    assert.strictEqual(apagado.opcoes.path, '/');
    assert.strictEqual(apagado.opcoes.sameSite, 'none');
    assert.strictEqual(apagado.opcoes.secure, true);
  }
});
