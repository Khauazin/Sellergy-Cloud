import api from './api';

const vendaService = {
  listar: async () => {
    const response = await api.get('/vendas');
    return response.data;
  },

  registrar: async (dados) => {
    const response = await api.post('/vendas', dados);
    return response.data;
  }
};

export default vendaService;
