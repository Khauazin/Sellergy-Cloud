// Factory da camada fiscal: resolve o adapter pelo nome do provedor.
// Uso (na rota/servico, apos carregar a ConfiguracaoFiscal do tenant):
//
//   const { criarProvedor } = require('../adapters/fiscal');
//   const credencial = await carregarCredencialDecifrada({ credencialId, clienteId });
//   const emissor = criarProvedor(config.provedor, { credencial, config, ambiente, modo: 'fixture' });
//   const doc = await emissor.emitirNFCe({ valor, descricao, refExterna });
//
// O resto do sistema so conhece esta factory + a interface ProvedorFiscal.

const { ProvedorFiscal, STATUS } = require('./ProvedorFiscal');
const FocusNFeAdapter = require('./focusNFe');
const NuvemFiscalAdapter = require('./nuvemFiscal');

const ADAPTERS = {
  FOCUS_NFE: FocusNFeAdapter,
  NUVEM_FISCAL: NuvemFiscalAdapter,
};

/** Emissores suportados (espelha enum `DocumentoFiscal.provedor` / `ConfiguracaoFiscal.provedor`). */
const PROVEDORES = Object.keys(ADAPTERS);

/** Mapa provedor -> TipoCredencial esperado no cofre. */
const TIPO_CREDENCIAL_POR_PROVEDOR = Object.freeze({
  FOCUS_NFE: 'FOCUS_NFE_KEY',
  NUVEM_FISCAL: 'NUVEM_FISCAL_KEY',
});

function criarProvedor(provedor, cfg = {}) {
  const Adapter = ADAPTERS[provedor];
  if (!Adapter) {
    throw Object.assign(new Error(`Emissor fiscal desconhecido: ${provedor}.`), {
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
  ProvedorFiscal,
};
