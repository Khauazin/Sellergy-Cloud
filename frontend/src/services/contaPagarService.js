// Cliente HTTP do modulo Contas a Pagar.
// Endpoints expostos em /contas-pagar (ver backend/src/routes/contas-pagar.routes.js).

import api from './api';

const contaPagarService = {
  listar: async (params = {}) => {
    const response = await api.get('/contas-pagar', { params });
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/contas-pagar', dados);
    return response.data;
  },

  editar: async (id, dados) => {
    const response = await api.put(`/contas-pagar/${id}`, dados);
    return response.data;
  },

  excluir: async (id) => {
    const response = await api.delete(`/contas-pagar/${id}`);
    return response.data;
  },

  // Marca como paga. Se tirarDoCaixa=true (default), exige caixa aberto e
  // gera Retirada + LancamentoFinanceiro DESPESA PAGO na mesma transacao.
  // Se false (boleto/PIX direto do banco), so cria o lancamento.
  pagar: async (id, { valor, motivo, tirarDoCaixa, dataVencimento }) => {
    const response = await api.post(`/contas-pagar/${id}/pagar`, {
      valor,
      motivo,
      tirarDoCaixa,
      dataVencimento,
    });
    return response.data;
  },
};

export default contaPagarService;
