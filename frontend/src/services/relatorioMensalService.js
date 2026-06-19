// Cliente HTTP do módulo Relatórios Mensais (snapshots persistidos).
import api from './api';

const relatorioMensalService = {
  // Lista os snapshots disponíveis do tenant (mais recentes primeiro).
  listar: async () => {
    const response = await api.get('/relatorios-mensais');
    return response.data;
  },

  // Busca o snapshot de um ano/mês específico.
  detalhe: async (ano, mes) => {
    const response = await api.get(`/relatorios-mensais/${ano}/${mes}`);
    return response.data;
  },

  // Dispara geração manual (CLIENT/ADMINISTRADOR). Sem args usa mês anterior.
  gerar: async ({ ano, mes } = {}) => {
    const response = await api.post('/relatorios-mensais/gerar', { ano, mes });
    return response.data;
  },
};

export default relatorioMensalService;
