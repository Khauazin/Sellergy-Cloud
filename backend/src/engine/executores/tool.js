// Invoca uma tool do agente direto do builder, sem LLM no meio.
// Reusa a mesma camada de permissoes do AI_AGENT (modulo liberado +
// tool habilitada no bot + auditoria), entao quem decidiu o que o bot
// pode fazer continua sendo a UNICA fonte da verdade.
//
// Forma do no:
//   no.dados.toolNome  = 'crm.criarLead'        — string fixa
//   no.dados.args      = { nome: '{{...}}', ... } — objeto com interpolacao recursiva
//
// Saida:
//   { sucesso: bool, resultado?: any, erro?: string }
//
// Por padrao, em caso de erro de permissao/validacao da tool, este no
// FALHA a execucao (lanca). Se quiser tratar o erro no fluxo (ex.: ramificar
// com IF), defina `no.dados.permitirFalha = true` que entao retorna saida
// com sucesso=false e segue.

const { interpolarProfundo } = require('../expressoes');
const { invocarTool } = require('../../agente/executor');

async function executar({ no, contexto }) {
  const dados = no.dados || {};
  const toolNome = typeof dados.toolNome === 'string' ? dados.toolNome.trim() : '';
  if (!toolNome) {
    throw new Error('TOOL: campo "toolNome" obrigatorio (ex.: "crm.criarLead").');
  }

  const argsBruto = (dados.args && typeof dados.args === 'object') ? dados.args : {};
  const args = interpolarProfundo(argsBruto, contexto);

  const r = await invocarTool({
    toolNome,
    args,
    contexto: {
      clienteId: contexto.clienteId,
      botId: contexto.botId,
      execucaoId: contexto.execucaoId,
      noId: no.id,
    },
  });

  if (!r.sucesso && !dados.permitirFalha) {
    throw new Error(`TOOL ${toolNome}: ${r.erro}`);
  }

  return {
    saida: {
      ...(contexto.entrada || {}),
      sucesso: r.sucesso,
      resultado: r.resultado || null,
      erro: r.erro || null,
    },
  };
}

module.exports = { executar };
