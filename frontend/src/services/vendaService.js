import api from './api';

const vendaService = {
  listar: async () => {
    const response = await api.get('/vendas');
    return response.data;
  },

  registrar: async (dados) => {
    const response = await api.post('/vendas', dados);
    return response.data;
  },

  // Cancela uma venda. Backend estorna estoque e cancela lancamentos
  // financeiros vinculados em uma unica transacao.
  cancelar: async (id, motivo) => {
    const response = await api.post(`/vendas/${id}/cancelar`, { motivo });
    return response.data;
  },
};

export default vendaService;
