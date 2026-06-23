// Adapter Focus NFe — implementa ProvedorFiscal.
// Auth: Basic com o token como usuario (senha vazia). Base homologacao:
// https://homologacao.focusnfe.com.br · producao: https://api.focusnfe.com.br.
// Emissao por `ref` (idempotente). Docs: /v2/nfce e /v2/nfse.

const { ProvedorFiscal, STATUS } = require('./ProvedorFiscal');

function baseUrl(ambiente) {
  return ambiente === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
}

// status do Focus -> status normalizado
function normalizar(s) {
  switch (s) {
    case 'autorizado': return STATUS.EMITIDA;
    case 'processando_autorizacao': return STATUS.PROCESSANDO;
    case 'cancelado': return STATUS.CANCELADA;
    case 'erro_autorizacao':
    case 'denegado': return STATUS.ERRO;
    default: return STATUS.PROCESSANDO;
  }
}

class FocusNFeAdapter extends ProvedorFiscal {
  static get provedor() { return 'FOCUS_NFE'; }

  get _token() { return this.credencial?.dados?.token || this.credencial?.dados?.apiKey; }

  _auth() {
    const b64 = Buffer.from(`${this._token || ''}:`).toString('base64');
    return { Authorization: `Basic ${b64}` };
  }

  async _emitir(tipo, { valor, descricao, refExterna, payload }) {
    const path = tipo === 'NFCE' ? 'v2/nfce' : 'v2/nfse';
    const req = {
      url: `${baseUrl(this.ambiente)}/${path}?ref=${encodeURIComponent(refExterna)}`,
      metodo: 'POST',
      headers: this._auth(),
      corpo: { valor_total: Number(valor), descricao, ...(payload || {}) },
    };
    const raw = await this._executar(req, () => ({ status: 'processando_autorizacao', ref: refExterna }));
    return {
      provedorDocId: String(raw.ref || refExterna),
      status: normalizar(raw.status),
      mensagemErro: raw.mensagem || raw.erros?.[0]?.mensagem,
      bruto: raw,
    };
  }

  emitirNFCe(p) { return this._emitir('NFCE', p); }
  emitirNFSe(p) { return this._emitir('NFSE', p); }

  async consultarStatus(provedorDocId) {
    const base = baseUrl(this.ambiente);
    const req = { url: `${base}/v2/nfce/${provedorDocId}`, headers: this._auth() };
    const raw = await this._executar(req, () => ({
      status: 'autorizado',
      numero: '000001234',
      chave_nfe: '35200114200166000187650010000012341000012345',
      caminho_danfe: `/notas/${provedorDocId}/danfe.pdf`,
      caminho_xml_nota_fiscal: `/notas/${provedorDocId}/nota.xml`,
    }));
    return {
      provedorDocId: String(provedorDocId),
      status: normalizar(raw.status),
      numero: raw.numero,
      chave: raw.chave_nfe,
      urlPdf: raw.caminho_danfe ? `${base}${raw.caminho_danfe}` : undefined,
      urlXml: raw.caminho_xml_nota_fiscal ? `${base}${raw.caminho_xml_nota_fiscal}` : undefined,
      mensagemErro: raw.mensagem,
      bruto: raw,
    };
  }

  async cancelar(provedorDocId, motivo) {
    const req = {
      url: `${baseUrl(this.ambiente)}/v2/nfce/${provedorDocId}`,
      metodo: 'DELETE',
      headers: this._auth(),
      corpo: { justificativa: motivo },
    };
    await this._executar(req, () => ({ status: 'cancelado' }));
    return { status: STATUS.CANCELADA };
  }
}

module.exports = FocusNFeAdapter;
