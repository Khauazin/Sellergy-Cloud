// Wrapper de domínio "mensagens" sobre o cofre generico.
// Mantém a API que ja era consumida por conversas.routes.js.
const { cifrar, decifrar, derivarChave, VERSAO_ATUAL, TAMANHO_IV, TAMANHO_TAG } = require('./cofre');

const SALT = 'sellergy-mensagens-v1';

module.exports = {
  cifrar: (clienteId, texto) => cifrar({ salt: SALT, clienteId, texto }),
  decifrar: (clienteId, registro) => decifrar({ salt: SALT, clienteId, registro }),
  derivarChaveTenant: (clienteId) => derivarChave(SALT, clienteId),
  VERSAO_ATUAL,
  TAMANHO_IV,
  TAMANHO_TAG,
};
