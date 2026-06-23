// Adapter Nuvem Fiscal — implementa ProvedorFiscal.
// Auth: Bearer (OAuth client_credentials -> access_token, obtido fora daqui e
// guardado no cofre). Base: https://api.nuvemfiscal.com.br. Emissao retorna
// id + status; o ambiente (homologacao/producao) vai no corpo.

const { ProvedorFiscal, STATUS } = require('./ProvedorFiscal');

const BASE = 'https://api.nuvemfiscal.com.br';

function normalizar(s) {
  switch (s) {
    case 'autorizado': return STATUS.EMITIDA;
    case 'pendente':
    case 'processando': return STATUS.PROCESSANDO;
    case 'cancelado': return STATUS.CANCELADA;
    case 'rejeitado':
    case 'erro': return STATUS.ERRO;
    default: return STATUS.PROCESSANDO;
  }
}

class NuvemFiscalAdapter extends ProvedorFiscal {
  static get provedor() { return 'NUVEM_FISCAL'; }

  get _token() { return this.credencial?.dados?.accessToken || this.credencial?.dados?.token; }
  _headers() { return { Authorization: `Bearer ${this._token || ''}` }; }

  async _emitir(tipo, { valor, descricao, refExterna, payload }) {
    const path = tipo === 'NFCE' ? 'nfce' : 'nfse';
    const req = {
      url: `${BASE}/${path}`,
      metodo: 'POST',
      headers: this._headers(),
      corpo: {
        ambiente: this.ambiente === 'producao' ? 'producao' : 'homologacao',
        referencia: refExterna,
        valor: Number(valor),
        descricao,
        ...(payload || {}),
      },
    };
    const raw = await this._executar(req, () => ({ id: `nf_${refExterna}`, status: 'pendente' }));
    return {
      provedorDocId: String(raw.id),
      status: normalizar(raw.status),
      mensagemErro: raw.mensagem,
      bruto: raw,
    };
  }

  emitirNFCe(p) { return this._emitir('NFCE', p); }
  emitirNFSe(p) { return this._emitir('NFSE', p); }

  async consultarStatus(provedorDocId) {
    const req = { url: `${BASE}/nfce/${provedorDocId}`, headers: this._headers() };
    const raw = await this._executar(req, () => ({
      id: provedorDocId,
      status: 'autorizado',
      numero: '1234',
      chave: '35200114200166000187650010000012341000012345',
      pdf: `${BASE}/nfce/${provedorDocId}/pdf`,
      xml: `${BASE}/nfce/${provedorDocId}/xml`,
    }));
    return {
      provedorDocId: String(provedorDocId),
      status: normalizar(raw.status),
      numero: raw.numero,
      chave: raw.chave,
      urlPdf: raw.pdf,
      urlXml: raw.xml,
      mensagemErro: raw.mensagem,
      bruto: raw,
    };
  }

  async cancelar(provedorDocId, motivo) {
    const req = {
      url: `${BASE}/nfce/${provedorDocId}/cancelamento`,
      metodo: 'POST',
      headers: this._headers(),
      corpo: { justificativa: motivo },
    };
    await this._executar(req, () => ({ status: 'cancelado' }));
    return { status: STATUS.CANCELADA };
  }
}

module.exports = NuvemFiscalAdapter;
