import api from './api';

const fornecedorService = {
  listar: async (params = {}) => {
    const { data } = await api.get('/fornecedores', { params });
    return data;
  },

  criar: async (dados) => {
    const { data } = await api.post('/fornecedores', dados);
    return data;
  },

  atualizar: async (id, dados) => {
    const { data } = await api.put(`/fornecedores/${id}`, dados);
    return data;
  },

  excluir: async (id) => {
    const { data } = await api.delete(`/fornecedores/${id}`);
    return data;
  },

  // Envia o CSV (campo "arquivo") pra importacao em massa validada no backend.
  importar: async (arquivo) => {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    const { data } = await api.post('/fornecedores/importar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

export default fornecedorService;
