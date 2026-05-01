const manual = require('./manual');
const set = require('./set');
const seCondicional = require('./if');
const httpRequest = require('./httpRequest');
const code = require('./code');

const EXECUTORES = {
  MANUAL: manual,
  SET: set,
  IF: seCondicional,
  HTTP_REQUEST: httpRequest,
  CODE: code,
};

function obterExecutor(tipo) {
  return EXECUTORES[tipo] || null;
}

module.exports = { obterExecutor, EXECUTORES };
