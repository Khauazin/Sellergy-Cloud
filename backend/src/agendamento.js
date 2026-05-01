// Helper de agendamentos: validacao de expressao cron, calculo de proximo
// disparo e sincronizacao do estado da tabela com os repeatable jobs do BullMQ.
const cronParser = require('cron-parser');
const prisma = require('./prisma');
const {
  adicionarRepeatableAgendamento,
  removerRepeatableAgendamento,
} = require('./filas');

// API moderna (v5) usa CronExpressionParser; mantemos fallback para a v4.
const parseExpressao = (expressao, opcoes) => {
  if (cronParser.CronExpressionParser?.parse) {
    return cronParser.CronExpressionParser.parse(expressao, opcoes);
  }
  return cronParser.parseExpression(expressao, opcoes);
};

function validarExpressaoCron(expressao, fusoHorario) {
  if (typeof expressao !== 'string' || expressao.trim() === '') {
    return { valido: false, erro: 'Expressao cron vazia.' };
  }
  try {
    parseExpressao(expressao, { tz: fusoHorario });
    return { valido: true };
  } catch (err) {
    return { valido: false, erro: `Expressao cron invalida: ${err.message}` };
  }
}

function proximoDisparo(expressao, fusoHorario) {
  try {
    return parseExpressao(expressao, { tz: fusoHorario }).next().toDate();
  } catch {
    return null;
  }
}

// Reflete na fila o estado salvo na tabela:
//  - se ativo: garante o repeatable atualizado
//  - se inativo: remove o repeatable
async function sincronizarAgendamento(agendamento) {
  if (!agendamento) return;
  if (agendamento.ativo) {
    await adicionarRepeatableAgendamento({
      agendamentoId: agendamento.id,
      expressaoCron: agendamento.expressaoCron,
      fusoHorario: agendamento.fusoHorario,
    });
  } else {
    await removerRepeatableAgendamento({ agendamentoId: agendamento.id });
  }
}

// Reconcilia todos os agendamentos do banco com a fila. Chamada no boot
// do worker para nao deixar pendencias caso a fila tenha sido limpa.
async function reconciliarAgendamentos() {
  const ativos = await prisma.agendamentoFluxo.findMany({ where: { ativo: true } });
  let ok = 0;
  let erros = 0;
  for (const ag of ativos) {
    try {
      await adicionarRepeatableAgendamento({
        agendamentoId: ag.id,
        expressaoCron: ag.expressaoCron,
        fusoHorario: ag.fusoHorario,
      });
      ok++;
    } catch (err) {
      console.error(`[reconciliar] agendamento ${ag.id} falhou:`, err.message);
      erros++;
    }
  }
  return { ok, erros, total: ativos.length };
}

module.exports = {
  validarExpressaoCron,
  proximoDisparo,
  sincronizarAgendamento,
  reconciliarAgendamentos,
};
