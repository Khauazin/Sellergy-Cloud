// Trigger MANUAL: nao processa nada, apenas propaga os dados do gatilho.
async function executar({ contexto }) {
  return { saida: contexto.dadosGatilho || {} };
}

module.exports = { executar };
