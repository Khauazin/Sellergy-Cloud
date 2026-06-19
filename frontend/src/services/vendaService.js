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

  // Vincula (ou desvincula com leadId=null) um cliente a venda ja registrada.
  // Backend propaga pros lancamentos financeiros vinculados.
  vincularLead: async (id, leadId) => {
    const response = await api.put(`/vendas/${id}/lead`, { leadId: leadId || null });
    return response.data;
  },
};

export default vendaService;
