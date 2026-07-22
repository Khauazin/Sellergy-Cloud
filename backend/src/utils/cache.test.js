// Testes de SEGURANÇA do cache: a chave é sempre isolada por tenant + usuário.
// (Funções puras — não tocam no Redis.)
// Rodar com:  node --test

const { test } = require('node:test');
const assert = require('node:assert');
const { chaveTenant, hashParte } = require('./cache');

test('chaveTenant exige namespace e clienteId (nunca cacheia sem escopo)', () => {
  assert.throws(() => chaveTenant('', { clienteId: 'c1' }), /namespace/);
  assert.throws(() => chaveTenant('ns', {}), /clienteId/);
  assert.throws(() => chaveTenant('ns', { clienteId: '' }), /clienteId/);
});

test('tenants diferentes -> chaves diferentes (isolamento)', () => {
  const a = chaveTenant('dash', { clienteId: 'tenantA', usuarioId: 'u1' }, '/dash');
  const b = chaveTenant('dash', { clienteId: 'tenantB', usuarioId: 'u1' }, '/dash');
  assert.notEqual(a, b);
  assert.ok(a.includes('tenantA'));
  assert.ok(!a.includes('tenantB'));
});

test('usuarios diferentes do mesmo tenant -> chaves diferentes (sem vazamento entre usuarios)', () => {
  const a = chaveTenant('rel', { clienteId: 't1', usuarioId: 'vendedorA' }, '/vendas');
  const b = chaveTenant('rel', { clienteId: 't1', usuarioId: 'vendedorB' }, '/vendas');
  assert.notEqual(a, b);
});

test('querystring/filtros diferentes -> chaves diferentes', () => {
  const a = chaveTenant('rel', { clienteId: 't1', usuarioId: 'u1' }, '/vendas?periodo=mes');
  const b = chaveTenant('rel', { clienteId: 't1', usuarioId: 'u1' }, '/vendas?periodo=ano');
  assert.notEqual(a, b);
});

test('mesmas entradas -> mesma chave (deterministico)', () => {
  const a = chaveTenant('dash', { clienteId: 't1', usuarioId: 'u1' }, '/x?a=1');
  const b = chaveTenant('dash', { clienteId: 't1', usuarioId: 'u1' }, '/x?a=1');
  assert.equal(a, b);
  assert.match(a, /^cache:dash:t1:u1:[0-9a-f]{16}$/);
});

test('hashParte: estavel, tamanho fixo e sensivel a mudanca', () => {
  assert.equal(hashParte('abc'), hashParte('abc'));
  assert.notEqual(hashParte('abc'), hashParte('abd'));
  assert.equal(hashParte('qualquer coisa longa aqui').length, 16);
});
