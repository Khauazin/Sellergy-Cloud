import api from './api';

const financeiroService = {
  listarLancamentosCompleto: async (params) => {
    const r = await api.get('/financeiro/lancamentos', { params });
    return r.data; // { dados, paginacao }
  },
  listarLancamentos: async (params) => {
    const r = await api.get('/financeiro/lancamentos', { params });
    return Array.isArray(r.data) ? r.data : (r.data.dados ?? []);
  },
  buscarParaGrafico: async ({ inicio, fim } = {}) => {
    const r = await api.get('/financeiro/lancamentos', { params: { inicio, fim, limite: 1000, pagina: 1 } });
    return Array.isArray(r.data) ? r.data : (r.data.dados ?? []);
  },
  criarLancamento: async (dados) => { const r = await api.post('/financeiro/lancamentos', dados); return r.data; },
  atualizarStatus: async (id, status, dataPagamento) => {
    const r = await api.patch(`/financeiro/lancamentos/${id}/status`, { status, dataPagamento });
    return r.data;
  },
  // Novos métodos analíticos
  buscarDashboard: async () => { const r = await api.get('/financeiro/dashboard'); return r.data; },
  buscarInadimplencia: async () => { const r = await api.get('/financeiro/inadimplencia'); return r.data; },
  buscarRelatorioDRE: async ({ inicio, fim } = {}) => {
    const r = await api.get('/financeiro/relatorio-dre', { params: { inicio, fim } });
    return r.data;
  },
  
  listarCategorias: async () => { const r = await api.get('/financeiro/categorias'); return r.data; },
  criarCategoria: async (dados) => { const r = await api.post('/financeiro/categorias', dados); return r.data; },
  excluirCategoria: async (id) => { const r = await api.delete(`/financeiro/categorias/${id}`); return r.data; },
};

export default financeiroService;
