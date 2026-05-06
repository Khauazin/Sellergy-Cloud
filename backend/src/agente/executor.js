// Executor de tools do agente. Responsavel por:
//   1. Resolver a tool pelo nome (registry)
//   2. Validar permissao em 3 camadas:
//      - tool existe
//      - modulo da tool esta liberado para o tenant (`cliente.modulosLiberados`)
//      - tool esta na lista do bot (`bot.toolsHabilitadas`)
//   3. Executar
//   4. Auditar (sucesso ou erro) na tabela auditoria_acoes_agente
//
// Uso (na Sub-fase 3.6 vai ser chamado pelo executor de AI_AGENT):
//   const r = await invocarTool({
//     toolNome, args, contexto: { clienteId, fluxoId, execucaoId, noId, botId }
//   });
//   if (r.sucesso) usar r.resultado; else r.erro

const prisma = require('../prisma');
const { obterTool } = require('./tools');

async function invocarTool({ toolNome, args, contexto = {} }) {
  const inicio = Date.now();
  const auditoriaBase = {
    execucaoId: contexto.execucaoId || null,
    noId: contexto.noId || null,
    toolNome,
    args: args ?? null,
  };

  // Idempotencia / sanidade — sem execucaoId vamos auditar mesmo assim,
  // mas precisamos de um execucaoId pra FK. Se nao tiver, nao audita.
  const podeAuditar = !!auditoriaBase.execucaoId;

  async function auditar(payload) {
    if (!podeAuditar) return;
    try {
      await prisma.auditoriaAcaoAgente.create({
        data: {
          ...auditoriaBase,
          ...payload,
          duracaoMs: Date.now() - inicio,
        },
      });
    } catch (e) {
      console.error('[agente/audit]', e?.message || e);
    }
  }

  try {
    const tool = obterTool(toolNome);
    if (!tool) {
      const erro = `Tool desconhecida: ${toolNome}`;
      await auditar({ sucesso: false, erro });
      return { sucesso: false, erro };
    }

    // 1. modulo liberado pro tenant
    const modulosLiberados = await modulosDoTenant(contexto.clienteId);
    if (modulosLiberados[tool.modulo] !== true) {
      const erro = `Modulo "${tool.modulo}" nao esta liberado para este tenant.`;
      await auditar({ sucesso: false, erro });
      return { sucesso: false, erro };
    }

    // 2. tool habilitada no bot (se botId presente)
    if (contexto.botId) {
      const habilitadas = await toolsHabilitadasDoBot(contexto.botId);
      if (!habilitadas.includes(toolNome)) {
        const erro = `Tool "${toolNome}" nao esta habilitada neste bot.`;
        await auditar({ sucesso: false, erro });
        return { sucesso: false, erro };
      }
    }

    // 3. validacao de schema (campos obrigatorios)
    for (const campo of tool.parametros?.obrigatorios || []) {
      const v = args?.[campo];
      if (v === undefined || v === null || v === '') {
        const erro = `Parametro obrigatorio ausente: ${campo}.`;
        await auditar({ sucesso: false, erro });
        return { sucesso: false, erro };
      }
    }

    const resultado = await tool.executar({ args: args || {}, contexto });
    await auditar({ sucesso: true, resultado });
    return { sucesso: true, resultado };
  } catch (e) {
    const erro = String(e?.message || e);
    await auditar({ sucesso: false, erro });
    return { sucesso: false, erro };
  }
}

async function modulosDoTenant(clienteId) {
  if (!clienteId) return {};
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { modulosLiberados: true },
  });
  return cliente?.modulosLiberados || {};
}

async function toolsHabilitadasDoBot(botId) {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    select: { toolsHabilitadas: true },
  });
  const lista = bot?.toolsHabilitadas;
  return Array.isArray(lista) ? lista : [];
}

module.exports = { invocarTool };
