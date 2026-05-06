// Helpers de upload/remocao de imagens. Cada funcao retorna o `imagemUrl`
// novo (string) ou lanca erro.
import api from './api';

function montarFormData(file) {
  const fd = new FormData();
  fd.append('imagem', file);
  return fd;
}

export async function uploadImagemProduto(produtoId, file) {
  const resp = await api.post(`/catalogo/${produtoId}/imagem`, montarFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data?.imagemUrl;
}

export async function removerImagemProduto(produtoId) {
  await api.delete(`/catalogo/${produtoId}/imagem`);
}

export async function uploadImagemVariacao(variacaoId, file) {
  const resp = await api.post(`/catalogo/variacoes/${variacaoId}/imagem`, montarFormData(file), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data?.imagemUrl;
}

export async function removerImagemVariacao(variacaoId) {
  await api.delete(`/catalogo/variacoes/${variacaoId}/imagem`);
}

export async function obterPrecoVariacao(variacaoId) {
  const resp = await api.get(`/catalogo/variacoes/${variacaoId}/preco`);
  return resp.data;
}

export default {
  uploadImagemProduto,
  removerImagemProduto,
  uploadImagemVariacao,
  removerImagemVariacao,
  obterPrecoVariacao,
};
