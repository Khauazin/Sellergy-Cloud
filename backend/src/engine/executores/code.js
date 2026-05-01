const { executarCodigoIsolado } = require('../sandbox');

// Executa codigo JS arbitrario num isolated-vm.
async function executar({ no, contexto }) {
  const codigo = no.dados?.codigo;
  if (typeof codigo !== 'string' || codigo.trim() === '') {
    return { saida: contexto.entrada || {} };
  }

  const resultado = await executarCodigoIsolado({
    codigo,
    entrada: contexto.entrada || {},
    variaveis: contexto.variaveis || {},
  });

  return { saida: resultado.saida };
}

module.exports = { executar };
