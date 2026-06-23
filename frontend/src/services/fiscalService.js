// Service do Fiscal. Config do emissor por tenant + emissao/consulta de
// DocumentoFiscal. Espelha backend/src/routes/fiscal.routes.js.

import api from './api';

export async function obterConfig() {
  const r = await api.get('/fiscal/config');
  return r.data;
}

export async function salvarConfig(dados) {
  const r = await api.put('/fiscal/config', dados);
  return r.data;
}

export async function listarDocumentos(status) {
  const r = await api.get('/fiscal/documentos', { params: status ? { status } : {} });
  return r.data;
}

export async function emitir(dados) {
  const r = await api.post('/fiscal/documentos', dados);
  return r.data;
}

export async function sincronizar(id) {
  const r = await api.post(`/fiscal/documentos/${id}/sincronizar`);
  return r.data;
}

export async function cancelar(id, motivo) {
  const r = await api.post(`/fiscal/documentos/${id}/cancelar`, { motivo });
  return r.data;
}

export default { obterConfig, salvarConfig, listarDocumentos, emitir, sincronizar, cancelar };
