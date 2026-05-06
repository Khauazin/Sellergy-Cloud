const prisma = require('../prisma');
const { obterExecutor } = require('./executores');
const { aplicarPolitica } = require('./registroLog');

// Limites para proteger o processo do servidor durante o engine sincrono (Sub-fase 1.3).
// Quando o engine virou consumidor de fila (Sub-fase 2.1) o limite passou a ser por job.
const LIMITE_PASSOS = 1000;

/**
 * Cria um registro de Execucao com status PENDENTE. O caller decide quando
 * (e se) enfileira para processamento. Retorna o registro completo.
 */
async function criarExecucaoPendente({
  fluxoId,
  usuarioId = null,
  dadosGatilho = null,
  modo = 'MANUAL',
}) {
  const fluxo = await prisma.fluxo.findUnique({
    where: { id: fluxoId },
    select: { id: true },
  });
  if (!fluxo) throw new Error('Fluxo nao encontrado.');

  return prisma.execucao.create({
    data: {
      fluxoId,
      modo,
      status: 'PENDENTE',
      iniciadaPorId: usuarioId,
      dadosGatilho,
    },
  });
}

/**
 * Processa uma Execucao previamente criada como PENDENTE. Marca como
 * EM_EXECUCAO no inicio e finaliza com SUCESSO ou ERRO. Idempotente:
 * se ja foi processada, retorna o registro como esta.
 *
 * @param {string} execucaoId
 * @param {object} [opcoes]
 * @param {(evento: object) => Promise<void>|void} [opcoes.onProgresso]
 *   callback chamado em cada transicao relevante (no iniciado/finalizado,
 *   execucao iniciada/finalizada). Erros do callback sao engolidos.
 */
async function processarExecucao(execucaoId, opcoes = {}) {
  const onProgresso = typeof opcoes.onProgresso === 'function'
    ? async (evento) => {
        try { await opcoes.onProgresso(evento); }
        catch (e) { console.error('[engine/onProgresso]', e?.message || e); }
      }
    : async () => {};
  const execucao = await prisma.execucao.findUnique({
    where: { id: execucaoId },
    include: {
      fluxo: {
        include: {
          nos: true,
          conexoes: true,
          bot: { select: { id: true, clienteId: true } },
        },
      },
    },
  });
  if (!execucao) throw new Error(`Execucao ${execucaoId} nao encontrada.`);
  if (execucao.status !== 'PENDENTE') return execucao;

  const fluxo = execucao.fluxo;
  const nivelLog = fluxo.nivelLog || 'METADATA';
  const TIPOS_TRIGGER = ['MANUAL', 'WEBHOOK', 'SCHEDULE'];
  const noTrigger = execucao.noTriggerId
    ? fluxo.nos.find((n) => n.id === execucao.noTriggerId)
    : fluxo.nos.find((n) => TIPOS_TRIGGER.includes(n.tipo));

  if (!noTrigger) {
    return prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: 'ERRO',
        finalizadaEm: new Date(),
        erro: execucao.noTriggerId
          ? `No trigger ${execucao.noTriggerId} nao encontrado.`
          : 'Fluxo nao possui no de trigger (MANUAL/WEBHOOK/SCHEDULE).',
      },
    });
  }

  const inicioMs = Date.now();
  await prisma.execucao.update({
    where: { id: execucao.id },
    data: { status: 'EM_EXECUCAO', iniciadaEm: new Date() },
  });
  await onProgresso({ tipo: 'execucao:inicio', execucaoId: execucao.id });

  // Mapa de saidas: noOrigemId -> [{ alvo, pontoOrigem }]
  const saidasPorNo = new Map();
  for (const c of fluxo.conexoes) {
    if (!saidasPorNo.has(c.noOrigemId)) saidasPorNo.set(c.noOrigemId, []);
    saidasPorNo.get(c.noOrigemId).push({ alvo: c.noDestinoId, pontoOrigem: c.pontoOrigem || null });
  }
  const nosPorId = new Map(fluxo.nos.map((n) => [n.id, n]));

  let contexto = {
    entrada: execucao.dadosGatilho || {},
    variaveis: {},
    dadosGatilho: execucao.dadosGatilho || {},
    // Identificadores usados por executores que carregam recursos do tenant
    // (ex: HTTP_REQUEST -> credencial, AI_AGENT -> credencial+tools).
    clienteId: fluxo.bot?.clienteId || null,
    botId: fluxo.bot?.id || null,
    fluxoId: fluxo.id,
    execucaoId: execucao.id,
  };

  let passos = 0;
  const visitados = new Set();

  async function processarNo(noId) {
    if (visitados.has(noId)) return;
    if (++passos > LIMITE_PASSOS) {
      throw new Error(`Limite de ${LIMITE_PASSOS} passos por execucao atingido.`);
    }
    visitados.add(noId);

    const no = nosPorId.get(noId);
    if (!no) throw new Error(`No nao encontrado: ${noId}`);

    const executor = obterExecutor(no.tipo);
    if (!executor) throw new Error(`Tipo de no nao suportado: ${no.tipo}`);

    const inicioNoMs = Date.now();
    const registro = await prisma.execucaoNo.create({
      data: {
        execucaoId: execucao.id,
        noId: no.id,
        tipo: no.tipo,
        status: 'EM_EXECUCAO',
        entrada: aplicarPolitica(contexto.entrada, nivelLog),
      },
    });
    await onProgresso({
      tipo: 'no:inicio',
      execucaoId: execucao.id,
      noExecucaoId: registro.id,
      noId: no.id,
      tipoNo: no.tipo,
    });

    try {
      const resultado = await executor.executar({ no, contexto });
      const duracaoNo = Date.now() - inicioNoMs;
      await prisma.execucaoNo.update({
        where: { id: registro.id },
        data: {
          status: 'SUCESSO',
          saida: aplicarPolitica(resultado?.saida ?? null, nivelLog),
          finalizadoEm: new Date(),
          duracaoMs: duracaoNo,
        },
      });
      await onProgresso({
        tipo: 'no:fim',
        execucaoId: execucao.id,
        noExecucaoId: registro.id,
        noId: no.id,
        status: 'SUCESSO',
        duracaoMs: duracaoNo,
      });

      contexto = {
        ...contexto,
        entrada: resultado?.saida ?? {},
        variaveis: { ...contexto.variaveis, ...(resultado?.novasVariaveis || {}) },
      };

      const proximas = (saidasPorNo.get(no.id) || []).filter((s) =>
        resultado?.proximaSaida == null
          ? s.pontoOrigem == null
          : s.pontoOrigem === resultado.proximaSaida
      );

      for (const p of proximas) {
        await processarNo(p.alvo);
      }
    } catch (err) {
      const duracaoNo = Date.now() - inicioNoMs;
      await prisma.execucaoNo.update({
        where: { id: registro.id },
        data: {
          status: 'ERRO',
          erro: String(err?.message || err),
          // Em erro forcamos COMPLETO (com truncamento) para debug.
          entrada: aplicarPolitica(contexto.entrada, nivelLog, { tipoErro: true }),
          finalizadoEm: new Date(),
          duracaoMs: duracaoNo,
        },
      });
      await onProgresso({
        tipo: 'no:fim',
        execucaoId: execucao.id,
        noExecucaoId: registro.id,
        noId: no.id,
        status: 'ERRO',
        duracaoMs: duracaoNo,
      });
      throw err;
    }
  }

  try {
    await processarNo(noTrigger.id);
    const final = await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: 'SUCESSO',
        finalizadaEm: new Date(),
        duracaoMs: Date.now() - inicioMs,
      },
    });
    await onProgresso({
      tipo: 'execucao:fim',
      execucaoId: execucao.id,
      status: 'SUCESSO',
      duracaoMs: final.duracaoMs,
    });
    return final;
  } catch (err) {
    const final = await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: 'ERRO',
        finalizadaEm: new Date(),
        duracaoMs: Date.now() - inicioMs,
        erro: String(err?.message || err),
      },
    });
    await onProgresso({
      tipo: 'execucao:fim',
      execucaoId: execucao.id,
      status: 'ERRO',
      duracaoMs: final.duracaoMs,
    });
    return final;
  }
}

// Conveniencia: cria + processa em uma chamada (modo legado/sincrono).
async function executarFluxoSincrono(args) {
  const exec = await criarExecucaoPendente(args);
  return processarExecucao(exec.id);
}

module.exports = {
  criarExecucaoPendente,
  processarExecucao,
  executarFluxoSincrono,
  LIMITE_PASSOS,
};
