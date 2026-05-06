const manual = require('./manual');
const webhook = require('./webhook');
const set = require('./set');
const seCondicional = require('./if');
const httpRequest = require('./httpRequest');
const code = require('./code');
const aiAgent = require('./aiAgent');
const enviarMensagem = require('./enviarMensagem');
const setEstadoConversa = require('./setEstadoConversa');
const tool = require('./tool');

const EXECUTORES = {
  MANUAL: manual,
  WEBHOOK: webhook,
  SET: set,
  IF: seCondicional,
  HTTP_REQUEST: httpRequest,
  CODE: code,
  AI_AGENT: aiAgent,
  ENVIAR_MENSAGEM: enviarMensagem,
  SET_ESTADO_CONVERSA: setEstadoConversa,
  TOOL: tool,
};

function obterExecutor(tipo) {
  return EXECUTORES[tipo] || null;
}

module.exports = { obterExecutor, EXECUTORES };
