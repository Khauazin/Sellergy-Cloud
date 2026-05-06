// Executor do nó AI_AGENT — chamada a um LLM com suporte a function calling.
//
// Suporta 3 provedores via HTTP direto:
//   OPENAI    — POST /v1/chat/completions
//   ANTHROPIC — POST /v1/messages
//   GEMINI    — POST .../generateContent
//
// Quando o bot tem `toolsHabilitadas`, cada chamada inclui o catalogo de
// tools no formato do provedor. Se o LLM responder com tool_call/tool_use/
// functionCall, o engine executa a tool, devolve o resultado pro LLM e
// continua o loop ate o LLM retornar resposta final (sem mais pedidos).
//
// Limite de iteracoes: 10 (evita loop infinito). Cada iteracao = 1 round-trip.
//
// Tools indisponiveis (modulo nao liberado, nao habilitada no bot, etc.) sao
// retornadas como erro pro LLM no `tool_result` — o LLM decide se tenta outra
// coisa ou desiste com texto.

const axios = require('axios');
const prisma = require('../../prisma');
const { interpolar } = require('../expressoes');
const { carregarCredencialDecifrada } = require('../../credenciais');
const { decifrar } = require('../../cripto/cofreMensagens');
const { listarTools } = require('../../agente/tools');
const { invocarTool } = require('../../agente/executor');
const {
  paraOpenAI,
  paraAnthropic,
  paraGemini,
  nomeLLMParaInterno,
} = require('../../agente/converterTools');

const TEMPERATURA_PADRAO = 0.7;
const MAX_TOKENS_PADRAO = 1024;
const MAX_TOKENS_HARD_CAP = 4096;
const TIMEOUT_MS = 60_000;
const TAMANHO_MAX_MENSAGEM = 100_000;
const MAX_ITERACOES_TOOL_LOOP = 10;
const HISTORICO_MAX_MENSAGENS = 20;

const PROVEDORES_VALIDOS = new Set(['OPENAI', 'ANTHROPIC', 'GEMINI']);

const TIPO_CREDENCIAL_POR_PROVEDOR = {
  OPENAI: 'OPENAI_API_KEY',
  ANTHROPIC: 'ANTHROPIC_API_KEY',
  GEMINI: 'GEMINI_API_KEY',
};

async function executar({ no, contexto }) {
  const dados = no.dados || {};
  const provedor = String(dados.provedor || '').toUpperCase();

  if (!PROVEDORES_VALIDOS.has(provedor)) {
    throw new Error(`AI_AGENT: provedor invalido (${provedor || 'vazio'}). Use OPENAI, ANTHROPIC ou GEMINI.`);
  }
  if (typeof dados.modelo !== 'string' || !dados.modelo.trim()) {
    throw new Error('AI_AGENT: campo "modelo" obrigatorio.');
  }
  if (!dados.credencialId) {
    throw new Error('AI_AGENT: campo "credencialId" obrigatorio.');
  }

  const credencial = await carregarCredencialDecifrada({
    credencialId: dados.credencialId,
    clienteId: contexto.clienteId,
  });
  if (!credencial) throw new Error('AI_AGENT: credencial nao encontrada.');
  const tipoEsperado = TIPO_CREDENCIAL_POR_PROVEDOR[provedor];
  if (credencial.tipo !== tipoEsperado) {
    throw new Error(`AI_AGENT: credencial e do tipo ${credencial.tipo}, mas provedor ${provedor} exige ${tipoEsperado}.`);
  }

  const promptSistema = interpolar(dados.prompt || '', contexto);

  // Quando a execucao foi disparada por uma conversa de canal (Telegram/WhatsApp),
  // o LLM precisa do historico pra fazer multi-turno (ex.: pergunta nome -> espera
  // resposta -> pergunta CPF). Sem isso ele nao lembra o que perguntou antes.
  // Fora desse caso (fluxo sem canal), usa apenas a mensagem do no como antes.
  const conversaId = contexto?.dadosGatilho?.conversaId || null;
  const historico = conversaId
    ? await carregarHistoricoConversa({ conversaId, clienteId: contexto.clienteId })
    : [];

  const mensagemUsuario = historico.length === 0
    ? interpolar(dados.mensagemUsuario || '{{entrada}}', contexto)
    : '';

  const tamanhoEstimado = promptSistema.length + mensagemUsuario.length
    + historico.reduce((soma, m) => soma + (m.content?.length || 0), 0);
  if (tamanhoEstimado > TAMANHO_MAX_MENSAGEM) {
    throw new Error(`AI_AGENT: mensagem excede ${TAMANHO_MAX_MENSAGEM} caracteres apos interpolacao.`);
  }

  const temperatura = clamp(Number(dados.temperatura ?? TEMPERATURA_PADRAO), 0, 2);
  const maxTokens = clamp(Number(dados.maxTokens) || MAX_TOKENS_PADRAO, 1, MAX_TOKENS_HARD_CAP);
  const modelo = dados.modelo.trim();

  // Carrega tools disponiveis (filtradas por bot.toolsHabilitadas + modulo
  // liberado). Se vazia, faz chamada simples sem tools (comportamento 3.4).
  const toolsDisponiveis = await carregarToolsDoBot({
    botId: contexto.botId,
    clienteId: contexto.clienteId,
  });

  const contextoTool = {
    ...contexto,
    noId: no.id,
    botId: contexto.botId,
  };

  const params = {
    modelo, promptSistema, mensagemUsuario, historico, temperatura, maxTokens,
    credencial, toolsDisponiveis, contextoTool,
  };

  switch (provedor) {
    case 'OPENAI': return loopOpenAI(params);
    case 'ANTHROPIC': return loopAnthropic(params);
    case 'GEMINI': return loopGemini(params);
  }
}

// ===========================================================
// Historico da conversa (decifra mensagens TEXTO em ordem cronologica)
// ===========================================================
// Retorna [{ role: 'user'|'assistant', content: string }] ja na ordem em
// que devem ir pro LLM. A ultima mensagem normalmente eh a do usuario que
// disparou o fluxo agora (o dispatcher persiste antes de enfileirar).
async function carregarHistoricoConversa({ conversaId, clienteId }) {
  if (!conversaId || !clienteId) return [];
  try {
    const linhas = await prisma.mensagemConversa.findMany({
      where: { conversaId, clienteId, tipo: 'TEXTO' },
      orderBy: { criadoEm: 'desc' },
      take: HISTORICO_MAX_MENSAGENS,
      select: {
        sentido: true,
        conteudoCifrado: true,
        iv: true,
        tag: true,
        versaoChave: true,
      },
    });

    const out = [];
    for (const m of linhas.reverse()) {
      let texto;
      try {
        texto = decifrar(clienteId, m);
      } catch {
        continue; // mensagem com chave incompativel — ignora
      }
      if (typeof texto !== 'string' || texto.trim() === '') continue;
      out.push({
        role: m.sentido === 'ENTRADA' ? 'user' : 'assistant',
        content: texto,
      });
    }
    return out;
  } catch (e) {
    console.error('[aiAgent/historico]', e?.message || e);
    return [];
  }
}

// ===========================================================
// Tools disponiveis pro bot (filtradas por modulo + habilitacao)
// ===========================================================
async function carregarToolsDoBot({ botId, clienteId }) {
  if (!botId || !clienteId) return [];
  const [bot, cliente] = await Promise.all([
    prisma.bot.findUnique({ where: { id: botId }, select: { toolsHabilitadas: true } }),
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { modulosLiberados: true } }),
  ]);
  if (!bot) return [];
  const habilitadas = Array.isArray(bot.toolsHabilitadas) ? bot.toolsHabilitadas : [];
  if (habilitadas.length === 0) return [];
  const modulosLiberados = cliente?.modulosLiberados || {};

  return listarTools().filter(
    (t) => habilitadas.includes(t.nome) && modulosLiberados[t.modulo] === true
  );
}

// ===========================================================
// LOOP OpenAI
// ===========================================================
async function loopOpenAI({ modelo, promptSistema, mensagemUsuario, historico, temperatura, maxTokens, credencial, toolsDisponiveis, contextoTool }) {
  const headers = {
    'Authorization': `Bearer ${credencial.dados.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (credencial.dados.organizationId) headers['OpenAI-Organization'] = credencial.dados.organizationId;

  const messages = [];
  if (promptSistema) messages.push({ role: 'system', content: promptSistema });
  if (historico && historico.length > 0) {
    for (const h of historico) messages.push({ role: h.role, content: h.content });
  } else {
    messages.push({ role: 'user', content: mensagemUsuario });
  }

  let totalTokens = 0;
  const chamadasTools = [];

  for (let it = 0; it < MAX_ITERACOES_TOOL_LOOP; it++) {
    const body = { model: modelo, messages, temperature: temperatura, max_tokens: maxTokens };
    if (toolsDisponiveis.length > 0) {
      body.tools = paraOpenAI(toolsDisponiveis);
      body.tool_choice = 'auto';
    }

    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      body,
      { headers, timeout: TIMEOUT_MS, validateStatus: () => true }
    );
    if (resp.status >= 400) {
      throw new Error(`AI_AGENT (OpenAI ${resp.status}): ${extrairErro(resp.data)}`);
    }

    totalTokens += resp.data?.usage?.total_tokens || 0;
    const choice = resp.data?.choices?.[0];
    const msg = choice?.message;
    const finish = choice?.finish_reason;

    if (finish !== 'tool_calls' || !Array.isArray(msg?.tool_calls) || msg.tool_calls.length === 0) {
      // Resposta final
      return {
        saida: {
          resposta: msg?.content || '',
          modelo: resp.data?.model || modelo,
          tokensUsados: totalTokens,
          finalizadoPor: finish,
          chamadasTools,
        },
      };
    }

    // Adiciona a resposta do assistant (com tool_calls) na conversa
    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });

    // Executa cada tool e adiciona resultado
    for (const tc of msg.tool_calls) {
      const nomeLLM = tc.function?.name;
      const nomeInterno = nomeLLMParaInterno(nomeLLM);
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* args invalido */ }

      const r = await invocarTool({ toolNome: nomeInterno || nomeLLM, args, contexto: contextoTool });
      chamadasTools.push({ nome: nomeInterno || nomeLLM, args, sucesso: r.sucesso, resultado: r.resultado, erro: r.erro });

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(r.sucesso ? r.resultado : { erro: r.erro }),
      });
    }
  }

  throw new Error(`AI_AGENT: limite de ${MAX_ITERACOES_TOOL_LOOP} iteracoes de tool atingido.`);
}

// ===========================================================
// LOOP Anthropic
// ===========================================================
async function loopAnthropic({ modelo, promptSistema, mensagemUsuario, historico, temperatura, maxTokens, credencial, toolsDisponiveis, contextoTool }) {
  const headers = {
    'x-api-key': credencial.dados.apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };

  // Anthropic nao aceita 2 mensagens consecutivas com mesmo role. Garante
  // alternancia user/assistant — se o historico vier de um canal que iniciou
  // com bot, a primeira pode ser assistant; a API reclama. Solucao: se a
  // primeira do historico for assistant, descarta-a.
  let mensagensIniciais;
  if (historico && historico.length > 0) {
    const inicio = historico[0]?.role === 'assistant' ? 1 : 0;
    mensagensIniciais = historico.slice(inicio).map((h) => ({ role: h.role, content: h.content }));
    if (mensagensIniciais.length === 0) {
      mensagensIniciais = [{ role: 'user', content: mensagemUsuario || '...' }];
    }
  } else {
    mensagensIniciais = [{ role: 'user', content: mensagemUsuario }];
  }
  const messages = [...mensagensIniciais];
  let totalTokens = 0;
  const chamadasTools = [];

  for (let it = 0; it < MAX_ITERACOES_TOOL_LOOP; it++) {
    const body = { model: modelo, max_tokens: maxTokens, temperature: temperatura, messages };
    if (promptSistema) body.system = promptSistema;
    if (toolsDisponiveis.length > 0) body.tools = paraAnthropic(toolsDisponiveis);

    const resp = await axios.post(
      'https://api.anthropic.com/v1/messages',
      body,
      { headers, timeout: TIMEOUT_MS, validateStatus: () => true }
    );
    if (resp.status >= 400) {
      throw new Error(`AI_AGENT (Anthropic ${resp.status}): ${extrairErro(resp.data)}`);
    }

    totalTokens += (resp.data?.usage?.input_tokens || 0) + (resp.data?.usage?.output_tokens || 0);
    const blocos = resp.data?.content || [];
    const stop = resp.data?.stop_reason;

    if (stop !== 'tool_use') {
      const texto = blocos.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return {
        saida: {
          resposta: texto,
          modelo: resp.data?.model || modelo,
          tokensUsados: totalTokens,
          finalizadoPor: stop,
          chamadasTools,
        },
      };
    }

    // Anthropic: adiciona a resposta do assistant inteira (com blocos text + tool_use)
    messages.push({ role: 'assistant', content: blocos });

    // Pra cada tool_use, executa e adiciona um bloco tool_result
    const toolResults = [];
    for (const bloco of blocos) {
      if (bloco.type !== 'tool_use') continue;
      const nomeInterno = nomeLLMParaInterno(bloco.name);
      const r = await invocarTool({ toolNome: nomeInterno || bloco.name, args: bloco.input || {}, contexto: contextoTool });
      chamadasTools.push({ nome: nomeInterno || bloco.name, args: bloco.input, sucesso: r.sucesso, resultado: r.resultado, erro: r.erro });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: bloco.id,
        content: JSON.stringify(r.sucesso ? r.resultado : { erro: r.erro }),
        is_error: !r.sucesso,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error(`AI_AGENT: limite de ${MAX_ITERACOES_TOOL_LOOP} iteracoes de tool atingido.`);
}

// ===========================================================
// LOOP Gemini
// ===========================================================
async function loopGemini({ modelo, promptSistema, mensagemUsuario, historico, temperatura, maxTokens, credencial, toolsDisponiveis, contextoTool }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(credencial.dados.apiKey)}`;
  // Gemini usa role 'model' no lugar de 'assistant'.
  const contents = (historico && historico.length > 0)
    ? historico.map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }))
    : [{ role: 'user', parts: [{ text: mensagemUsuario }] }];

  let totalTokens = 0;
  const chamadasTools = [];

  for (let it = 0; it < MAX_ITERACOES_TOOL_LOOP; it++) {
    const body = {
      contents,
      generationConfig: { temperature: temperatura, maxOutputTokens: maxTokens },
    };
    if (promptSistema) body.systemInstruction = { role: 'system', parts: [{ text: promptSistema }] };
    if (toolsDisponiveis.length > 0) body.tools = paraGemini(toolsDisponiveis);

    const resp = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    });
    if (resp.status >= 400) {
      throw new Error(`AI_AGENT (Gemini ${resp.status}): ${extrairErro(resp.data)}`);
    }

    totalTokens += resp.data?.usageMetadata?.totalTokenCount || 0;
    const cand = resp.data?.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      const texto = parts.map((p) => p.text || '').join('');
      return {
        saida: {
          resposta: texto,
          modelo,
          tokensUsados: totalTokens,
          finalizadoPor: cand?.finishReason,
          chamadasTools,
        },
      };
    }

    // Adiciona a resposta do model (com functionCall) na conversa
    contents.push({ role: 'model', parts });

    const responseParts = [];
    for (const p of functionCalls) {
      const nomeLLM = p.functionCall.name;
      const nomeInterno = nomeLLMParaInterno(nomeLLM);
      const args = p.functionCall.args || {};
      const r = await invocarTool({ toolNome: nomeInterno || nomeLLM, args, contexto: contextoTool });
      chamadasTools.push({ nome: nomeInterno || nomeLLM, args, sucesso: r.sucesso, resultado: r.resultado, erro: r.erro });
      responseParts.push({
        functionResponse: {
          name: nomeLLM,
          response: r.sucesso ? (r.resultado || {}) : { erro: r.erro },
        },
      });
    }
    contents.push({ role: 'function', parts: responseParts });
  }

  throw new Error(`AI_AGENT: limite de ${MAX_ITERACOES_TOOL_LOOP} iteracoes de tool atingido.`);
}

// ===========================================================
// Utilitarios
// ===========================================================

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function extrairErro(corpo) {
  if (!corpo) return 'sem corpo';
  if (typeof corpo === 'string') return corpo.slice(0, 500);
  return (
    corpo.error?.message ||
    corpo.error?.code ||
    corpo.message ||
    JSON.stringify(corpo).slice(0, 500)
  );
}

module.exports = { executar };
