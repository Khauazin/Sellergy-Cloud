// Converte o catalogo interno de tools (com schema simplificado) para o
// formato esperado por cada provedor de LLM. Tambem mapeia nomes:
//   interno: 'crm.criarLead'  <->  LLM: 'crm_criarLead'
//
// Os 3 provedores (OpenAI, Anthropic, Gemini) tem o conceito de "tool/
// function calling" mas com payload diferente. Aqui ficam todos os
// adaptadores num unico arquivo pra facilitar manutencao.

const { obterTool } = require('./tools');

function nomeInternoParaLLM(nome) {
  return nome.replace(/\./g, '_');
}

function nomeLLMParaInterno(nome) {
  // Tools internas seguem o padrao 'modulo.acao'. O mapeamento reverso troca
  // o PRIMEIRO underscore por ponto. Se o nome do LLM nao casar com nenhuma
  // tool, retorna null.
  const candidatos = [];
  for (let i = 0; i < nome.length; i++) {
    if (nome[i] === '_') {
      candidatos.push(nome.slice(0, i) + '.' + nome.slice(i + 1));
    }
  }
  for (const c of candidatos) {
    if (obterTool(c)) return c;
  }
  return null;
}

// Schema interno -> JSON Schema (formato comum aos 3 provedores).
function schemaParaJsonSchema(parametros) {
  const props = {};
  const propsInternas = parametros?.propriedades || {};
  for (const [chave, def] of Object.entries(propsInternas)) {
    props[chave] = {
      type: def.tipo || 'string',
      description: def.descricao || undefined,
    };
    if (Array.isArray(def.enum)) props[chave].enum = def.enum;
  }
  return {
    type: 'object',
    properties: props,
    required: parametros?.obrigatorios || [],
    additionalProperties: false,
  };
}

// ===========================================================
// OpenAI: { type: 'function', function: { name, description, parameters } }
// ===========================================================
function paraOpenAI(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: nomeInternoParaLLM(t.nome),
      description: t.descricao,
      parameters: schemaParaJsonSchema(t.parametros),
    },
  }));
}

// ===========================================================
// Anthropic: { name, description, input_schema }
// ===========================================================
function paraAnthropic(tools) {
  return tools.map((t) => ({
    name: nomeInternoParaLLM(t.nome),
    description: t.descricao,
    input_schema: schemaParaJsonSchema(t.parametros),
  }));
}

// ===========================================================
// Gemini: { functionDeclarations: [{ name, description, parameters }] }
// (passa um array de blocos, mas o tipico e um unico bloco com varias funcoes)
// ===========================================================
function paraGemini(tools) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: nomeInternoParaLLM(t.nome),
        description: t.descricao,
        parameters: schemaParaJsonSchema(t.parametros),
      })),
    },
  ];
}

module.exports = {
  nomeInternoParaLLM,
  nomeLLMParaInterno,
  schemaParaJsonSchema,
  paraOpenAI,
  paraAnthropic,
  paraGemini,
};
