// Service de Pagamentos (PSP). Config do provedor por tenant + ciclo de vida
// da Cobranca. Espelha backend/src/routes/pagamentos.routes.js.

import api from './api';

export async function obterConfig() {
  const r = await api.get('/pagamentos/config');
  return r.data;
}

export async function salvarConfig({ provedor, credencialId, ativo }) {
  const r = await api.put('/pagamentos/config', { provedor, credencialId, ativo });
  return r.data;
}

export async function listarCobrancas(status) {
  const r = await api.get('/pagamentos/cobrancas', { params: status ? { status } : {} });
  return r.data;
}

export async function criarCobranca(dados) {
  const r = await api.post('/pagamentos/cobrancas', dados);
  return r.data;
}

export async function sincronizar(id) {
  const r = await api.post(`/pagamentos/cobrancas/${id}/sincronizar`);
  return r.data;
}

export default { obterConfig, salvarConfig, listarCobrancas, criarCobranca, sincronizar };
