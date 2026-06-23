// Adapter Mercado Pago — implementa ProvedorPagamento.
// Auth: Bearer access_token. Base: https://api.mercadopago.com
// Docs: /v1/payments (Pix), /checkout/preferences (link), /v1/payments/{id}/refunds.
// Webhook: { type:'payment', data:{ id } } + assinatura x-signature (ts,v1=HMAC).

const crypto = require('crypto');
const { ProvedorPagamento, STATUS } = require('./ProvedorPagamento');

const BASE = 'https://api.mercadopago.com';

// status do MP → status normalizado
function normalizarStatus(s) {
  switch (s) {
    case 'approved': return STATUS.PAGO;
    case 'authorized': return STATUS.PAGO;
    case 'pending':
    case 'in_process':
    case 'in_mediation': return STATUS.PENDENTE;
    case 'cancelled': return STATUS.CANCELADO;
    case 'rejected': return STATUS.CANCELADO;
    case 'refunded':
    case 'charged_back': return STATUS.ESTORNADO;
    default: return STATUS.PENDENTE;
  }
}

class MercadoPagoAdapter extends ProvedorPagamento {
  static get provedor() { return 'MERCADO_PAGO'; }

  get _token() { return this.credencial?.dados?.accessToken || this.credencial?.dados?.token; }

  _headers(idempotencyKey) {
    const h = { Authorization: `Bearer ${this._token}` };
    if (idempotencyKey) h['X-Idempotency-Key'] = idempotencyKey;
    return h;
  }

  async criarCobrancaPix({ valor, descricao, refExterna, pagador }) {
    const req = {
      url: `${BASE}/v1/payments`,
      metodo: 'POST',
      headers: this._headers(`pix-${refExterna}`),
      corpo: {
        transaction_amount: Number(valor),
        description: descricao,
        payment_method_id: 'pix',
        external_reference: refExterna,
        payer: { email: pagador?.email || 'sem-email@sellergy.app' },
      },
    };
    const raw = await this._executar(req, () => ({
      id: `mp_pix_${refExterna}`,
      status: 'pending',
      date_of_expiration: new Date(Date.now() + 86_400_000).toISOString(),
      point_of_interaction: {
        transaction_data: {
          qr_code: '00020126fixtureEMVpixmercadopago5204000053039865802BR6304ABCD',
          qr_code_base64: 'iVBORw0KGgoFIXTUREbase64==',
          ticket_url: `https://www.mercadopago.com/payments/${refExterna}/ticket`,
        },
      },
    }));
    const td = raw.point_of_interaction?.transaction_data || {};
    return {
      provedorCobrancaId: String(raw.id),
      status: normalizarStatus(raw.status),
      qrCode: td.qr_code,
      qrCodeBase64: td.qr_code_base64,
      linkUrl: td.ticket_url,
      vencimento: raw.date_of_expiration,
      bruto: raw,
    };
  }

  async criarLink({ valor, descricao, refExterna }) {
    const req = {
      url: `${BASE}/checkout/preferences`,
      metodo: 'POST',
      headers: this._headers(),
      corpo: {
        items: [{ title: descricao, quantity: 1, unit_price: Number(valor), currency_id: 'BRL' }],
        external_reference: refExterna,
      },
    };
    const raw = await this._executar(req, () => ({
      id: `mp_pref_${refExterna}`,
      init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mp_pref_${refExterna}`,
    }));
    return {
      provedorCobrancaId: String(raw.id),
      status: STATUS.PENDENTE,
      linkUrl: raw.init_point,
      bruto: raw,
    };
  }

  async consultarStatus(provedorCobrancaId) {
    const req = { url: `${BASE}/v1/payments/${provedorCobrancaId}`, headers: this._headers() };
    const raw = await this._executar(req, () => ({ id: provedorCobrancaId, status: 'approved', date_approved: new Date().toISOString() }));
    return { status: normalizarStatus(raw.status), pagoEm: raw.date_approved || undefined };
  }

  async estornar(provedorCobrancaId) {
    const req = { url: `${BASE}/v1/payments/${provedorCobrancaId}/refunds`, metodo: 'POST', headers: this._headers(`refund-${provedorCobrancaId}`) };
    await this._executar(req, () => ({ id: `refund_${provedorCobrancaId}`, status: 'approved' }));
    return { status: STATUS.ESTORNADO };
  }

  // x-signature: "ts=<unix>,v1=<hmac>"; manifest = id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  verificarAssinatura({ headers, segredo }) {
    const sig = headers['x-signature'] || headers['X-Signature'];
    if (!sig || !segredo) return false;
    const partes = Object.fromEntries(String(sig).split(',').map((p) => p.split('=').map((x) => x.trim())));
    const ts = partes.ts;
    const v1 = partes.v1;
    if (!ts || !v1) return false;
    const dataId = headers['x-data-id'] || headers['data.id'] || '';
    const requestId = headers['x-request-id'] || '';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const esperado = crypto.createHmac('sha256', segredo).update(manifest).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
    } catch { return false; }
  }

  parsearWebhook({ body }) {
    if (!body || body.type !== 'payment') return null;
    const id = body.data?.id;
    if (!id) return null;
    // O webhook do MP traz só o id — o status definitivo vem de consultarStatus().
    return { provedorCobrancaId: String(id), status: STATUS.PENDENTE, evento: body.action || body.type };
  }
}

module.exports = MercadoPagoAdapter;
