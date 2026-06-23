// Factory da camada de pagamentos: resolve o adapter pelo nome do provedor.
// Uso (na rota/serviço, após carregar a ConfiguracaoPagamento do tenant):
//
//   const { criarProvedor } = require('../adapters/pagamento');
//   const credencial = await carregarCredencialDecifrada({ credencialId, clienteId });
//   const psp = criarProvedor(config.provedor, { credencial, ambiente, modo: 'fixture' });
//   const cob = await psp.criarCobrancaPix({ valor, descricao, refExterna });
//
// O resto do sistema só conhece esta factory + a interface ProvedorPagamento —
// nunca um PSP específico.

const { ProvedorPagamento, STATUS } = require('./ProvedorPagamento');
const MercadoPagoAdapter = require('./mercadoPago');
const AsaasAdapter = require('./asaas');
const PagarmeAdapter = require('./pagarme');

const ADAPTERS = {
  MERCADO_PAGO: MercadoPagoAdapter,
  ASAAS: AsaasAdapter,
  PAGARME: PagarmeAdapter,
};

/** Provedores suportados (espelha enum `Cobranca.provedor` / `ConfiguracaoPagamento.provedor`). */
const PROVEDORES = Object.keys(ADAPTERS);

/** Mapa provedor → TipoCredencial esperado no cofre. */
const TIPO_CREDENCIAL_POR_PROVEDOR = Object.freeze({
  MERCADO_PAGO: 'MERCADO_PAGO_KEY',
  ASAAS: 'ASAAS_KEY',
  PAGARME: 'PAGARME_KEY',
});

/**
 * @param {string} provedor  MERCADO_PAGO | ASAAS | PAGARME
 * @param {Object} cfg        { credencial, ambiente?, modo? }
 * @returns {ProvedorPagamento}
 */
function criarProvedor(provedor, cfg = {}) {
  const Adapter = ADAPTERS[provedor];
  if (!Adapter) {
    throw Object.assign(new Error(`Provedor de pagamento desconhecido: ${provedor}.`), {
      status: 400, codigo: 'PROVEDOR_INVALIDO',
    });
  }
  return new Adapter(cfg);
}

module.exports = {
  criarProvedor,
  PROVEDORES,
  TIPO_CREDENCIAL_POR_PROVEDOR,
  STATUS,
  ProvedorPagamento,
};
