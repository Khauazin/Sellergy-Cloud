import api from './api';

const notaCompraService = {
  listar: async () => {
    const { data } = await api.get('/notas-compra');
    return data;
  },

  buscarPorId: async (id) => {
    const { data } = await api.get(`/notas-compra/${id}`);
    return data;
  },

  // dados: { fornecedorId?, numero?, emitidaEm?, observacoes?, pago, itens:[{variacaoId, quantidade, custoUnitario}] }
  criar: async (dados) => {
    const { data } = await api.post('/notas-compra', dados);
    return data;
  },

  // Lê o XML da NF-e e devolve um preview (não grava nada).
  importarXml: async (arquivo) => {
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    const { data } = await api.post('/notas-compra/importar-xml', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};

export default notaCompraService;
