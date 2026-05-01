const ivm = require('isolated-vm');

const TIMEOUT_PADRAO_MS = 10_000;
const MEMORIA_LIMITE_MB = 128;

// Executa um trecho JS arbitrario num isolate com limites estritos. Sem `require`,
// sem network, sem Node API. Retorna o valor de `return` do snippet (que e
// envolvido em IIFE para que o usuario possa usar `return entrada;` direto).
async function executarCodigoIsolado({
  codigo,
  entrada = {},
  variaveis = {},
  timeoutMs = TIMEOUT_PADRAO_MS,
}) {
  if (typeof codigo !== 'string') {
    throw new Error('Code: codigo precisa ser string.');
  }

  const isolate = new ivm.Isolate({ memoryLimit: MEMORIA_LIMITE_MB });
  try {
    const ctx = await isolate.createContext();
    await ctx.global.set('entrada', new ivm.ExternalCopy(entrada).copyInto());
    await ctx.global.set('variaveis', new ivm.ExternalCopy(variaveis).copyInto());

    const wrap = `(function(){\n${codigo}\n})()`;
    const script = await isolate.compileScript(wrap);
    const resultado = await script.run(ctx, { timeout: timeoutMs, copy: true });
    return { saida: resultado };
  } finally {
    isolate.dispose();
  }
}

// Avalia uma expressao booleana num isolate. Para o no IF.
async function avaliarCondicaoIsolada({
  expressao,
  entrada = {},
  variaveis = {},
  timeoutMs = TIMEOUT_PADRAO_MS,
}) {
  if (typeof expressao !== 'string' || expressao.trim() === '') return false;

  const isolate = new ivm.Isolate({ memoryLimit: MEMORIA_LIMITE_MB });
  try {
    const ctx = await isolate.createContext();
    await ctx.global.set('entrada', new ivm.ExternalCopy(entrada).copyInto());
    await ctx.global.set('variaveis', new ivm.ExternalCopy(variaveis).copyInto());

    const script = await isolate.compileScript(`Boolean(${expressao})`);
    const resultado = await script.run(ctx, { timeout: timeoutMs, copy: true });
    return Boolean(resultado);
  } finally {
    isolate.dispose();
  }
}

module.exports = {
  executarCodigoIsolado,
  avaliarCondicaoIsolada,
  TIMEOUT_PADRAO_MS,
  MEMORIA_LIMITE_MB,
};
