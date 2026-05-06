// Service de credenciais. Os endpoints NUNCA retornam dadosCifrados/iv/tag —
// só metadata. Edição substitui os dados (re-cifra no backend).

import api from './api';

export async function listarTipos() {
  const r = await api.get('/credenciais/tipos');
  return r.data;
}

export async function listar() {
  const r = await api.get('/credenciais');
  return r.data;
}

export async function criar({ nome, tipo, descricao, dados }) {
  const r = await api.post('/credenciais', { nome, tipo, descricao, dados });
  return r.data;
}

export async function atualizar(id, { nome, descricao, dados }) {
  const r = await api.put(`/credenciais/${id}`, { nome, descricao, dados });
  return r.data;
}

export async function excluir(id) {
  await api.delete(`/credenciais/${id}`);
}

export default { listarTipos, listar, criar, atualizar, excluir };
