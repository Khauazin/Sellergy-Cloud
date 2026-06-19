// Cliente HTTP do módulo de Notificações.
import api from './api';

const notificacaoService = {
  // Lista as notificações do usuário atual + as do tenant inteiro (broadcast).
  // Retorna { itens: [...], totalNaoLidas: N }.
  listar: async (params = {}) => {
    const response = await api.get('/notificacoes', { params });
    return response.data;
  },

  marcarLida: async (id) => {
    const response = await api.patch(`/notificacoes/${id}/lida`);
    return response.data;
  },

  marcarTodasLidas: async () => {
    const response = await api.patch('/notificacoes/todas-lidas');
    return response.data;
  },

  // Lista todos os tipos válidos com o status atual (ativa: true/false).
  listarPreferencias: async () => {
    const response = await api.get('/notificacoes/preferencias');
    return response.data;
  },

  // Ativa ou desativa o recebimento de um tipo específico.
  atualizarPreferencia: async (tipo, ativa) => {
    const response = await api.put(`/notificacoes/preferencias/${tipo}`, { ativa });
    return response.data;
  },
};

export default notificacaoService;
