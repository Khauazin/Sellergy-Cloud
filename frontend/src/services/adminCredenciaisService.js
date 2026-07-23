import api from './api';

// Gestão das integrações (credenciais) de um cliente — SÓ ADMIN.
// Espelha backend/src/routes/admin-credenciais.routes.js. O segredo vai só no
// corpo; a API nunca devolve a chave em claro.
const adminCredenciaisService = {
  tipos: async () => {
    const { data } = await api.get('/credenciais/tipos');
    return data;
  },
  listar: async (clienteId) => {
    const { data } = await api.get(`/admin/clientes/${clienteId}/credenciais`);
    return data;
  },
  criar: async (clienteId, dados) => {
    const { data } = await api.post(`/admin/clientes/${clienteId}/credenciais`, dados);
    return data;
  },
  atualizar: async (clienteId, id, dados) => {
    const { data } = await api.put(`/admin/clientes/${clienteId}/credenciais/${id}`, dados);
    return data;
  },
  excluir: async (clienteId, id) => {
    const { data } = await api.delete(`/admin/clientes/${clienteId}/credenciais/${id}`);
    return data;
  },
};

export default adminCredenciaisService;
