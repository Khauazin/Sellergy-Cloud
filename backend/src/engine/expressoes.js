// Interpolador minimo de strings com placeholders no formato `{{caminho.dot}}`.
// Resolve caminhos contra o contexto (ex.: `entrada.usuario.nome`).

const PADRAO = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolverCaminho(obj, caminho) {
  return caminho.split('.').reduce((acc, parte) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[parte];
  }, obj);
}

function interpolar(template, contexto) {
  if (typeof template !== 'string') return template;
  return template.replace(PADRAO, (_, caminho) => {
    const valor = resolverCaminho(contexto, caminho);
    if (valor === undefined || valor === null) return '';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
  });
}

// Aplica `interpolar` recursivamente em strings dentro de arrays/objetos.
function interpolarProfundo(valor, contexto) {
  if (typeof valor === 'string') return interpolar(valor, contexto);
  if (Array.isArray(valor)) return valor.map((v) => interpolarProfundo(v, contexto));
  if (valor && typeof valor === 'object') {
    const saida = {};
    for (const k of Object.keys(valor)) {
      saida[k] = interpolarProfundo(valor[k], contexto);
    }
    return saida;
  }
  return valor;
}

module.exports = { interpolar, interpolarProfundo, resolverCaminho };
