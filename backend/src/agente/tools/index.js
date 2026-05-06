// Catalogo central de tools internas que agentes IA podem invocar.
//
// Cada tool tem a forma:
//   {
//     nome: 'modulo.acao',                  -- identificador unico
//     modulo: 'CRM' | 'AGENDA' | ...        -- modulo cuja liberacao e exigida
//     descricao: string                     -- mostrada ao LLM (function description)
//     parametros: {                         -- JSON Schema simplificado
//       tipo: 'object',
//       propriedades: { campo: { tipo, descricao, opcional?, enum? } },
//       obrigatorios: [string]
//     },
//     executar: async ({ args, contexto }) => resultado
//   }
//
// `contexto` e o mesmo do engine (clienteId, fluxoId, execucaoId, ...).
// Tools NUNCA recebem objetos do banco brutos — sempre retornam JSON serializavel
// pra que o LLM consiga usar e o audit possa logar.
//
// Para adicionar uma tool nova: criar arquivo em ./crm.js, ./agenda.js, etc.,
// exportar funcoes (objetos com .nome, .modulo, .descricao, .parametros, .executar)
// e registra-las em REGISTRO abaixo.

const crmTools = require('./crm');
const agendaTools = require('./agenda');
const catalogoTools = require('./catalogo');
const vendasTools = require('./vendas');
const mensagensTools = require('./mensagens');

const REGISTRO = new Map();

function registrar(tool) {
  if (!tool || !tool.nome) throw new Error('Tool sem nome.');
  if (REGISTRO.has(tool.nome)) throw new Error(`Tool ${tool.nome} ja registrada.`);
  REGISTRO.set(tool.nome, tool);
}

[...crmTools, ...agendaTools, ...catalogoTools, ...vendasTools, ...mensagensTools].forEach(registrar);

function obterTool(nome) {
  return REGISTRO.get(nome) || null;
}

function listarTools() {
  return Array.from(REGISTRO.values()).map((t) => ({
    nome: t.nome,
    modulo: t.modulo,
    descricao: t.descricao,
    parametros: t.parametros,
  }));
}

function nomesDisponiveis() {
  return Array.from(REGISTRO.keys());
}

module.exports = {
  registrar,
  obterTool,
  listarTools,
  nomesDisponiveis,
};
