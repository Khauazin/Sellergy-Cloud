// Testes de segurança/integridade das validações fiscais.
// Rodar com:  node --test  (ou: node --test backend/src/utils/validacaoFiscal.test.js)

const { test } = require('node:test');
const assert = require('node:assert');
const {
  validarCnpj, validarCpf, validarDocumento,
  validarNcm, validarCfop, validarCest, validarUf,
  resolverModoFiscal, conteudoCertificadoProibido, validarProntidaoProducao,
} = require('./validacaoFiscal');

// ---------- Documentos com dígito verificador ----------

test('CNPJ válido passa; inválido/repetido/curto falha', () => {
  assert.equal(validarCnpj('11222333000181'), true);
  assert.equal(validarCnpj('11.222.333/0001-81'), true); // aceita máscara
  assert.equal(validarCnpj('11222333000182'), false);    // dígito errado
  assert.equal(validarCnpj('11111111111111'), false);    // todos iguais
  assert.equal(validarCnpj('123'), false);               // curto
});

test('CPF válido passa; inválido falha', () => {
  assert.equal(validarCpf('52998224725'), true);
  assert.equal(validarCpf('529.982.247-25'), true);
  assert.equal(validarCpf('52998224724'), false);
  assert.equal(validarCpf('00000000000'), false);
});

test('validarDocumento aceita CNPJ(14) ou CPF(11), recusa lixo', () => {
  assert.equal(validarDocumento('11222333000181'), true);
  assert.equal(validarDocumento('52998224725'), true);
  assert.equal(validarDocumento('123456'), false);
  assert.equal(validarDocumento(''), false);
});

// ---------- Códigos fiscais (tamanho exato; vazio permitido) ----------

test('NCM/CFOP/CEST exigem tamanho exato; vazio é permitido', () => {
  assert.equal(validarNcm('12345678'), true);
  assert.equal(validarNcm('1234'), false);
  assert.equal(validarNcm(''), true);
  assert.equal(validarCfop('5102'), true);
  assert.equal(validarCfop('51020'), false);
  assert.equal(validarCest('1234567'), true);
  assert.equal(validarCest('12345'), false);
  assert.equal(validarUf('SP'), true);
  assert.equal(validarUf('XX'), false);
  assert.equal(validarUf(''), true);
});

// ---------- Modo: NUNCA vai a 'live' por acidente ----------

test('resolverModoFiscal só vai a live com FISCAL_LIVE=true E ambiente PRODUCAO', () => {
  const orig = process.env.FISCAL_LIVE;
  try {
    delete process.env.FISCAL_LIVE;
    assert.equal(resolverModoFiscal({ ambiente: 'PRODUCAO' }), 'fixture'); // sem flag

    process.env.FISCAL_LIVE = 'true';
    assert.equal(resolverModoFiscal({ ambiente: 'HOMOLOGACAO' }), 'fixture'); // flag mas homolog
    assert.equal(resolverModoFiscal({ ambiente: 'PRODUCAO' }), 'live');       // flag + producao

    process.env.FISCAL_LIVE = 'false';
    assert.equal(resolverModoFiscal({ ambiente: 'PRODUCAO' }), 'fixture');     // flag desligada
  } finally {
    if (orig === undefined) delete process.env.FISCAL_LIVE;
    else process.env.FISCAL_LIVE = orig;
  }
});

// ---------- Certificado NUNCA fica conosco ----------

test('conteudoCertificadoProibido detecta tentativa de enviar o certificado/senha', () => {
  assert.equal(conteudoCertificadoProibido({ pfx: 'MIIabc...' }), 'pfx');
  assert.equal(conteudoCertificadoProibido({ senhaCertificado: '123' }), 'senhaCertificado');
  assert.equal(conteudoCertificadoProibido({ certificadoBase64: 'AAAA' }), 'certificadoBase64');
  // certificadoRef gigante = provavelmente o binário -> recusa
  assert.equal(conteudoCertificadoProibido({ certificadoRef: 'a'.repeat(300) }), 'certificadoRef');
  // referência curta e legítima -> ok
  assert.equal(conteudoCertificadoProibido({ certificadoRef: 'ref-123', cnpj: '11222333000181' }), null);
  assert.equal(conteudoCertificadoProibido({}), null);
});

// ---------- Gate de produção ----------

test('validarProntidaoProducao: completo passa, incompleto lista o que falta', () => {
  const configOk = {
    razaoSocial: 'Empresa X', cnpj: '11222333000181', inscricao: '123456',
    logradouro: 'Rua A', municipio: 'Sao Paulo', uf: 'SP', cep: '01001000',
    certificadoRef: 'ref-1', credencialId: 'cred-1',
  };
  const itensOk = [{ ncm: '12345678', cfop: '5102' }];
  assert.deepEqual(validarProntidaoProducao(configOk, itensOk), []);

  const falta = validarProntidaoProducao({}, [{}]);
  assert.ok(falta.length >= 5, `esperava varias pendencias, veio: ${falta.length}`);
  assert.ok(falta.some((f) => /CNPJ/.test(f)));
  assert.ok(falta.some((f) => /NCM/.test(f)));
  assert.ok(falta.some((f) => /certificado/i.test(f)));
});
