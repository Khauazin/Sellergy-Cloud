// Politica de retencao/truncamento de payloads em ExecucaoNo.
//
// O `nivelLog` do Fluxo controla quanto detalhe entra no historico:
//   NENHUM   — nao salva entrada/saida (apenas status, duracao)
//   METADATA — salva sumario (chaves de topo + tamanho); nao salva
//              o payload bruto. Privacidade-friendly por padrao.
//   COMPLETO — salva o payload, mas truncado a MAX_BYTES_PAYLOAD.
//
// Erros sempre salvam o payload no nivel COMPLETO (truncado), independente
// do nivelLog do fluxo, para nao perder o contexto de debug.

const crypto = require('crypto');

const MAX_BYTES_PAYLOAD = 8 * 1024; // 8KB

function bytesDeJson(valor) {
  try {
    return Buffer.byteLength(JSON.stringify(valor ?? null), 'utf8');
  } catch {
    return Infinity;
  }
}

function hashCurto(valor) {
  try {
    const txt = JSON.stringify(valor ?? null);
    return crypto.createHash('sha256').update(txt).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function sumarioMetadata(valor) {
  if (valor === null || valor === undefined) return null;
  const tamanho = bytesDeJson(valor);
  if (Array.isArray(valor)) {
    return { __sumario: true, tipo: 'array', itens: valor.length, tamanhoBytes: tamanho };
  }
  if (typeof valor === 'object') {
    return {
      __sumario: true,
      tipo: 'objeto',
      chaves: Object.keys(valor).slice(0, 30),
      tamanhoBytes: tamanho,
      hash: hashCurto(valor),
    };
  }
  return { __sumario: true, tipo: typeof valor, tamanhoBytes: tamanho };
}

// Trunca um payload a MAX_BYTES_PAYLOAD. Se passar, substitui por marcador.
function truncarPayload(valor) {
  if (valor === null || valor === undefined) return valor;
  const tamanho = bytesDeJson(valor);
  if (tamanho <= MAX_BYTES_PAYLOAD) return valor;
  return {
    __truncado: true,
    tamanhoBytes: tamanho,
    limiteBytes: MAX_BYTES_PAYLOAD,
    hash: hashCurto(valor),
    sumario: sumarioMetadata(valor),
  };
}

// Aplica a politica do fluxo no payload antes de gravar em ExecucaoNo.
// `tipoErro=true` forca COMPLETO (com truncamento) — para o except/catch.
function aplicarPolitica(payload, nivelLog, { tipoErro = false } = {}) {
  if (tipoErro) return truncarPayload(payload);
  switch (nivelLog) {
    case 'NENHUM':
      return null;
    case 'METADATA':
      return sumarioMetadata(payload);
    case 'COMPLETO':
    default:
      return truncarPayload(payload);
  }
}

module.exports = {
  truncarPayload,
  sumarioMetadata,
  aplicarPolitica,
  MAX_BYTES_PAYLOAD,
};
