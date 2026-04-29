import api from './api';

const estoqueService = {
  listarMovimentacoes: async () => {
    const response = await api.get('/estoque/movimentacoes');
    return response.data;
  },

  buscarSaldo: async (variacaoId) => {
    const response = await api.get(`/estoque/saldo/${variacaoId}`);
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/estoque/dashboard');
    return response.data;
  },

  getReposicao: async () => {
    const response = await api.get('/estoque/reposicao');
    return response.data;
  },

  movimentar: async (dados) => {
    const response = await api.post('/estoque/movimentar', dados);
    return response.data;
  },

  ajusteBalanco: async (dados) => {
    const response = await api.post('/estoque/ajuste-balanco', dados);
    return response.data;
  },

  reservar: async (dados) => {
    const response = await api.post('/estoque/reservar', dados);
    return response.data;
  }
};

export default estoqueService;
