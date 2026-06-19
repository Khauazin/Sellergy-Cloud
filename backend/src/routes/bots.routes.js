const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('BOTS'));

const { nomesDisponiveis, listarTools } = require('../agente/tools');
const { presetDoSegmento } = require('../agente/presets');

// Campos seguros para listagem (sem apiKeyIa legacy). `credencialIaId` é
// só o ID — o conteúdo cifrado nunca sai do servidor.
const camposBotPublicos = {
  id: true,
  clienteId: true,
  nome: true,
  canal: true,
  status: true,
  telefone: true,
  totalMensagens: true,
  mensagensHoje: true,
  ultimaAtividadeEm: true,
  modeloIa: true,
  provedorIa: true,
  promptSistemaIa: true,
  temperaturaIa: true,
  credencialIaId: true,
  toolsHabilitadas: true,
  politicasAgente: true,
  credencialCanalId: true,
  identificadorCanal: true,
  verifyTokenCanal: true,
  fluxoPadraoId: true,
  criadoEm: true,
  atualizadoEm: true,
};

function filtroTenant(req) {
  // ADMIN do sistema vê tudo. Demais perfis ficam restritos ao seu clienteId.
  if (ehAdmin(req.usuario)) return {};
  return { clienteId: req.usuario.clienteId };
}

// Mapa provedor → tipo de credencial esperado.
const TIPO_POR_PROVEDOR = {
  OPENAI: 'OPENAI_API_KEY',
  ANTHROPIC: 'ANTHROPIC_API_KEY',
  GEMINI: 'GEMINI_API_KEY',
  DEEPSEEK: 'HTTP_API_KEY', // deepseek genérico via http
  CUSTOM: null, // qualquer
};

/**
 * Confirma que a credencial existe, pertence ao tenant e tem o tipo coerente
 * com o provedor escolhido. Retorna string de erro ou null se OK.
 */
async function validarCredencialIa({ credencialIaId, provedorIa, clienteId }) {
  if (!credencialIaId) return null;
  const where = { id: credencialIaId };
  // Quando temos clienteId (não-admin), restringe ao tenant pra evitar
  // que um cliente "roube" credencial de outro. ADMIN pula essa checagem.
  if (clienteId !== undefined && clienteId !== null) where.clienteId = clienteId;
  const cred = await prisma.credencial.findFirst({ where, select: { tipo: true } });
  if (!cred) return 'Credencial não encontrada ou não pertence ao tenant.';
  const tipoEsperado = TIPO_POR_PROVEDOR[String(provedorIa || '').toUpperCase()];
  if (tipoEsperado && cred.tipo !== tipoEsperado) {
    return `Credencial é do tipo ${cred.tipo}, mas o provedor ${provedorIa} exige ${tipoEsperado}.`;
  }
  return null;
}

// Sanitiza as politicas do agente (alcada/desconto/recompra/handoff) — aceita
// so as chaves conhecidas, com limites. Ver Bot.politicasAgente no schema.
function sanitizarPoliticas(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  if (typeof input.exigirConfirmacaoVenda === 'boolean') out.exigirConfirmacaoVenda = input.exigirConfirmacaoVenda;
  if (input.valorMaxVendaAuto === null || Number.isFinite(input.valorMaxVendaAuto)) out.valorMaxVendaAuto = input.valorMaxVendaAuto;
  if (typeof input.permiteDesconto === 'boolean') out.permiteDesconto = input.permiteDesconto;
  if (Number.isFinite(input.descontoMaxPercent)) out.descontoMaxPercent = Math.max(0, Math.min(100, input.descontoMaxPercent));
  if (input.cadenciaRecompraDias === null || Number.isFinite(input.cadenciaRecompraDias)) out.cadenciaRecompraDias = input.cadenciaRecompraDias;
  if (input.handoff && typeof input.handoff === 'object' && !Array.isArray(input.handoff)) {
    const h = {};
    if (Array.isArray(input.handoff.palavrasChave)) {
      h.palavrasChave = input.handoff.palavrasChave
        .filter((p) => typeof p === 'string').map((p) => p.trim()).filter(Boolean).slice(0, 20);
    }
    if (Number.isFinite(input.handoff.maxTurnosSemResolver)) {
      h.maxTurnosSemResolver = Math.max(1, Math.min(20, input.handoff.maxTurnosSemResolver));
    }
    out.handoff = h;
  }
  return out;
}

// Resolve o bot garantindo escopo de tenant (ADMIN ve qualquer um).
async function botDoTenant(req, id, select = { id: true }) {
  const where = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
  return prisma.bot.findFirst({ where, select });
}

roteador.get('/', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const bots = await prisma.bot.findMany({
      where: filtroTenant(req),
      select: {
        ...camposBotPublicos,
        cliente: { select: { nome: true } },
      },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(bots);
  } catch (erro) {
    console.error('[bots/list]', erro);
    res.status(500).json({ erro: 'Erro ao listar bots' });
  }
});

roteador.get('/:id', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const bot = await prisma.bot.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      select: { ...camposBotPublicos, cliente: { select: { nome: true, segmento: true } } },
    });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado' });
    res.json(bot);
  } catch (erro) {
    console.error('[bots/get]', erro);
    res.status(500).json({ erro: 'Erro ao buscar bot' });
  }
});

roteador.post('/', requerPermissao('BOTS', 'criar'), async (req, res) => {
  try {
    const {
      clienteId: clienteIdBody,
      nome, canal, telefone,
      provedorIa, modeloIa, promptSistemaIa, temperaturaIa,
      credencialIaId,
    } = req.body;

    // ADMIN pode criar para qualquer tenant; demais sao forcados ao proprio.
    const clienteId = ehAdmin(req.usuario) ? clienteIdBody : req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ erro: 'clienteId eh obrigatorio.' });
    }

    // Valida a credencial: precisa pertencer ao tenant e ser do tipo compatível
    // com o provedor escolhido. Bloqueia tentativa de usar credencial de outro
    // tenant (defense in depth: middleware já filtra acesso, mas confirmamos aqui).
    if (credencialIaId) {
      const erro = await validarCredencialIa({ credencialIaId, provedorIa, clienteId });
      if (erro) return res.status(422).json({ erro });
    }

    const bot = await prisma.bot.create({
      data: {
        clienteId,
        nome,
        canal,
        telefone,
        provedorIa,
        modeloIa,
        promptSistemaIa,
        temperaturaIa: temperaturaIa ? parseFloat(temperaturaIa) : 0.7,
        credencialIaId: credencialIaId || null,
      },
      select: camposBotPublicos,
    });
    res.status(201).json(bot);
  } catch (erro) {
    console.error('[bots/create]', erro);
    res.status(500).json({ erro: 'Erro ao criar bot' });
  }
});

roteador.put('/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;

    // Garante que o bot pertence ao tenant antes de atualizar.
    const existente = await prisma.bot.findFirst({
      where: { id, ...filtroTenant(req) },
      select: { id: true }
    });
    if (!existente) return res.status(404).json({ erro: 'Bot nao encontrado' });

    const {
      nome, canal, status, telefone,
      provedorIa, modeloIa, promptSistemaIa, temperaturaIa, credencialIaId,
    } = req.body;

    // Valida credencial se ela vier no payload (ignora se for null/undefined).
    if (credencialIaId) {
      const erro = await validarCredencialIa({
        credencialIaId,
        provedorIa,
        clienteId: req.usuario.clienteId || (ehAdmin(req.usuario) ? null : undefined),
      });
      if (erro) return res.status(422).json({ erro });
    }

    const bot = await prisma.bot.update({
      where: { id },
      data: {
        nome,
        canal,
        status,
        telefone,
        provedorIa,
        modeloIa,
        promptSistemaIa,
        // Aceita explicitamente null pra remover vínculo com credencial.
        ...(credencialIaId !== undefined ? { credencialIaId: credencialIaId || null } : {}),
        temperaturaIa: temperaturaIa ? parseFloat(temperaturaIa) : 0.7
      },
      select: camposBotPublicos,
    });

    if (req.io) req.io.emit('bot_atualizado', bot);

    res.json(bot);
  } catch (erro) {
    console.error('[bots/update]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar bot' });
  }
});

// ==========================================
// PUBLICAR / DESPUBLICAR — toggle de status ONLINE <-> OFFLINE.
// ERROR e estado de sistema (falha de execucao), nao setavel pela UI.
// Body: { status: 'ONLINE' | 'OFFLINE' }
// ==========================================
roteador.patch('/:id/status', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (status !== 'ONLINE' && status !== 'OFFLINE') {
      return res.status(400).json({ erro: "status deve ser 'ONLINE' ou 'OFFLINE'." });
    }

    const existente = await prisma.bot.findFirst({
      where: { id, ...filtroTenant(req) },
      select: { id: true },
    });
    if (!existente) return res.status(404).json({ erro: 'Bot nao encontrado' });

    const bot = await prisma.bot.update({
      where: { id },
      data: { status },
      select: camposBotPublicos,
    });

    if (req.io) req.io.emit('bot_atualizado', bot);
    res.json(bot);
  } catch (erro) {
    console.error('[bots/status]', erro);
    res.status(500).json({ erro: 'Erro ao mudar status do bot' });
  }
});

roteador.delete('/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    const existente = await prisma.bot.findFirst({
      where: { id, ...filtroTenant(req) },
      select: { id: true }
    });
    if (!existente) return res.status(404).json({ erro: 'Bot nao encontrado' });

    await prisma.bot.delete({ where: { id } });
    if (req.io) req.io.emit('bot_deletado', id);
    res.json({ message: 'Bot excluido com sucesso' });
  } catch (error) {
    console.error('[bots/delete]', error);
    res.status(500).json({ error: 'Erro ao excluir bot.' });
  }
});

roteador.post('/:id/duplicate', requerPermissao('BOTS', 'criar'), async (req, res) => {
  try {
    const { id } = req.params;

    const botOriginal = await prisma.bot.findFirst({
      where: { id, ...filtroTenant(req) },
      include: {
        fluxos: {
          include: { nos: true, conexoes: true }
        },
        variaveis: true,
        faqs: true
      }
    });

    if (!botOriginal) return res.status(404).json({ erro: 'Bot nao encontrado' });

    const novoBot = await prisma.bot.create({
      data: {
        clienteId: botOriginal.clienteId,
        nome: `${botOriginal.nome} (Copia)`,
        canal: botOriginal.canal,
        telefone: botOriginal.telefone,
        provedorIa: botOriginal.provedorIa,
        modeloIa: botOriginal.modeloIa,
        credencialIaId: botOriginal.credencialIaId,
        promptSistemaIa: botOriginal.promptSistemaIa,
        temperaturaIa: botOriginal.temperaturaIa,
        // Copia o "cerebro" do bot: tools habilitadas + politicas do agente.
        // Sem isso a copia nascia sem ferramentas nem alcada (perdia a config).
        toolsHabilitadas: botOriginal.toolsHabilitadas,
        politicasAgente: botOriginal.politicasAgente,
        status: 'OFFLINE'
      }
    });

    if (botOriginal.variaveis.length > 0) {
      await prisma.variavelBot.createMany({
        data: botOriginal.variaveis.map(v => ({
          botId: novoBot.id,
          chave: v.chave,
          valor: v.valor,
          descricao: v.descricao,
          tipo: v.tipo
        }))
      });
    }

    // Copia as FAQs (base de conhecimento) do bot original.
    if (botOriginal.faqs.length > 0) {
      await prisma.faqBot.createMany({
        data: botOriginal.faqs.map((f) => ({
          botId: novoBot.id,
          pergunta: f.pergunta,
          resposta: f.resposta,
          ativo: f.ativo,
          ordem: f.ordem
        }))
      });
    }

    for (const fluxoOriginal of botOriginal.fluxos) {
      const novoFluxo = await prisma.fluxo.create({
        data: {
          botId: novoBot.id,
          nome: fluxoOriginal.nome,
          ativo: fluxoOriginal.ativo,
          tipoGatilho: fluxoOriginal.tipoGatilho,
          palavraChaveGatilho: fluxoOriginal.palavraChaveGatilho
        }
      });

      const mapNodes = {};

      if (fluxoOriginal.nos.length > 0) {
        const createNodesPromise = fluxoOriginal.nos.map(n => {
          const novoIdNode = `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          mapNodes[n.id] = novoIdNode;

          return prisma.no.create({
            data: {
              id: novoIdNode,
              fluxoId: novoFluxo.id,
              tipo: n.tipo,
              posicaoX: n.posicaoX,
              posicaoY: n.posicaoY,
              dados: n.dados
            }
          });
        });
        await Promise.all(createNodesPromise);
      }

      if (fluxoOriginal.conexoes.length > 0) {
        const createEdgesPromise = fluxoOriginal.conexoes.map(e => {
          const novoIdEdge = `edge_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          return prisma.conexao.create({
            data: {
              id: novoIdEdge,
              fluxoId: novoFluxo.id,
              noOrigemId: mapNodes[e.noOrigemId],
              noDestinoId: mapNodes[e.noDestinoId],
              pontoOrigem: e.pontoOrigem
            }
          });
        });
        await Promise.all(createEdgesPromise);
      }
    }

    const botCompleto = await prisma.bot.findUnique({
      where: { id: novoBot.id },
      select: {
        ...camposBotPublicos,
        cliente: { select: { nome: true } },
      }
    });

    if (req.io) req.io.emit('bot_criado', botCompleto);

    res.status(201).json(botCompleto);
  } catch (error) {
    console.error('[bots/duplicate]', error);
    res.status(500).json({ error: 'Erro ao duplicar o bot.' });
  }
});

// ==========================================
// Configuracao de canal externo (Sub-fase 3.7)
// Body: { credencialCanalId?, identificadorCanal?, verifyTokenCanal?, fluxoPadraoId?, canal? }
// ==========================================
roteador.patch('/:id/canal', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const where = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
    const bot = await prisma.bot.findFirst({ where, select: { id: true, clienteId: true } });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });

    const { credencialCanalId, identificadorCanal, verifyTokenCanal, fluxoPadraoId, canal } = req.body || {};
    const data = {};

    if (canal !== undefined) {
      if (typeof canal !== 'string') return res.status(400).json({ erro: 'canal invalido.' });
      data.canal = canal;
    }
    if (credencialCanalId !== undefined) {
      if (credencialCanalId === null || credencialCanalId === '') {
        data.credencialCanalId = null;
      } else {
        const cred = await prisma.credencial.findFirst({
          where: { id: credencialCanalId, clienteId: bot.clienteId },
          select: { id: true },
        });
        if (!cred) return res.status(400).json({ erro: 'Credencial nao pertence ao tenant.' });
        data.credencialCanalId = credencialCanalId;
      }
    }
    if (identificadorCanal !== undefined) {
      data.identificadorCanal = identificadorCanal ? String(identificadorCanal).trim() : null;
    }
    if (verifyTokenCanal !== undefined) {
      data.verifyTokenCanal = verifyTokenCanal ? String(verifyTokenCanal).trim() : null;
    }
    if (fluxoPadraoId !== undefined) {
      if (fluxoPadraoId === null || fluxoPadraoId === '') {
        data.fluxoPadraoId = null;
      } else {
        const fluxo = await prisma.fluxo.findFirst({
          where: { id: fluxoPadraoId, botId: bot.id },
          select: { id: true },
        });
        if (!fluxo) return res.status(400).json({ erro: 'Fluxo nao pertence a este bot.' });
        data.fluxoPadraoId = fluxoPadraoId;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }

    const atualizado = await prisma.bot.update({
      where: { id: bot.id },
      data,
      select: camposBotPublicos,
    });
    res.json(atualizado);
  } catch (erro) {
    console.error('[bots/canal]', erro);
    res.status(500).json({ erro: 'Erro ao configurar canal.' });
  }
});

// ==========================================
// Tools habilitadas no bot (Sub-fase 3.5)
// ==========================================
roteador.patch('/:id/tools', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const lista = req.body?.toolsHabilitadas;
    if (!Array.isArray(lista)) {
      return res.status(400).json({ erro: 'toolsHabilitadas deve ser array.' });
    }

    const validas = new Set(nomesDisponiveis());
    const limpa = [];
    for (const nome of lista) {
      if (typeof nome !== 'string') continue;
      if (!validas.has(nome)) {
        return res.status(400).json({ erro: `Tool desconhecida: ${nome}` });
      }
      if (!limpa.includes(nome)) limpa.push(nome);
    }

    const where = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
    const bot = await prisma.bot.findFirst({ where, select: { id: true } });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });

    const atualizado = await prisma.bot.update({
      where: { id: bot.id },
      data: { toolsHabilitadas: limpa },
      select: { id: true, toolsHabilitadas: true },
    });
    res.json(atualizado);
  } catch (erro) {
    console.error('[bots/tools]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar tools.' });
  }
});

// ==========================================
// Comportamento do agente (politicas/alcada/recompra/handoff) — Fase 2.1
// Body: { politicasAgente: { ... } } — substitui o objeto inteiro.
// ==========================================
roteador.patch('/:id/politicas', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const bot = await botDoTenant(req, req.params.id);
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });

    const politicas = sanitizarPoliticas(req.body?.politicasAgente);
    const atualizado = await prisma.bot.update({
      where: { id: bot.id },
      data: { politicasAgente: politicas },
      select: { id: true, politicasAgente: true },
    });
    res.json(atualizado);
  } catch (erro) {
    console.error('[bots/politicas]', erro);
    res.status(500).json({ erro: 'Erro ao salvar politicas do agente.' });
  }
});

// ==========================================
// Base de conhecimento (FAQ) do bot — Fase 2.1
// ==========================================
const TAM_MAX_FAQ = 4000;

roteador.get('/:id/faq', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const bot = await botDoTenant(req, req.params.id);
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });
    const faqs = await prisma.faqBot.findMany({
      where: { botId: bot.id },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
    res.json(faqs);
  } catch (erro) {
    console.error('[bots/faq/list]', erro);
    res.status(500).json({ erro: 'Erro ao listar FAQ.' });
  }
});

roteador.post('/:id/faq', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const bot = await botDoTenant(req, req.params.id);
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });
    const { pergunta, resposta, ativo, ordem } = req.body || {};
    if (typeof pergunta !== 'string' || !pergunta.trim()) return res.status(400).json({ erro: 'pergunta obrigatoria.' });
    if (typeof resposta !== 'string' || !resposta.trim()) return res.status(400).json({ erro: 'resposta obrigatoria.' });
    if (pergunta.length > TAM_MAX_FAQ || resposta.length > TAM_MAX_FAQ) {
      return res.status(400).json({ erro: `Texto excede ${TAM_MAX_FAQ} caracteres.` });
    }
    const faq = await prisma.faqBot.create({
      data: {
        botId: bot.id,
        pergunta: pergunta.trim(),
        resposta: resposta.trim(),
        ativo: ativo === false ? false : true,
        ordem: Number.isFinite(ordem) ? ordem : 0,
      },
    });
    res.status(201).json(faq);
  } catch (erro) {
    console.error('[bots/faq/create]', erro);
    res.status(500).json({ erro: 'Erro ao criar FAQ.' });
  }
});

roteador.put('/:id/faq/:faqId', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const bot = await botDoTenant(req, req.params.id);
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });
    const existente = await prisma.faqBot.findFirst({
      where: { id: req.params.faqId, botId: bot.id }, select: { id: true },
    });
    if (!existente) return res.status(404).json({ erro: 'FAQ nao encontrada.' });

    const { pergunta, resposta, ativo, ordem } = req.body || {};
    const data = {};
    if (pergunta !== undefined) {
      if (typeof pergunta !== 'string' || !pergunta.trim() || pergunta.length > TAM_MAX_FAQ) {
        return res.status(400).json({ erro: 'pergunta invalida.' });
      }
      data.pergunta = pergunta.trim();
    }
    if (resposta !== undefined) {
      if (typeof resposta !== 'string' || !resposta.trim() || resposta.length > TAM_MAX_FAQ) {
        return res.status(400).json({ erro: 'resposta invalida.' });
      }
      data.resposta = resposta.trim();
    }
    if (ativo !== undefined) data.ativo = ativo === true;
    if (ordem !== undefined && Number.isFinite(ordem)) data.ordem = ordem;
    if (Object.keys(data).length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });

    const faq = await prisma.faqBot.update({ where: { id: existente.id }, data });
    res.json(faq);
  } catch (erro) {
    console.error('[bots/faq/update]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar FAQ.' });
  }
});

roteador.delete('/:id/faq/:faqId', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const bot = await botDoTenant(req, req.params.id);
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });
    const faq = await prisma.faqBot.findFirst({
      where: { id: req.params.faqId, botId: bot.id }, select: { id: true },
    });
    if (!faq) return res.status(404).json({ erro: 'FAQ nao encontrada.' });
    await prisma.faqBot.delete({ where: { id: faq.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[bots/faq/delete]', erro);
    res.status(500).json({ erro: 'Erro ao excluir FAQ.' });
  }
});

// ==========================================
// Aplicar preset do segmento (motor unico + perfis) — Fase 2.1
// Sobrescreve tools, prompt base e politicas com os defaults do segmento do tenant.
// ==========================================
roteador.post('/:id/aplicar-preset', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const bot = await botDoTenant(req, req.params.id, { id: true, clienteId: true });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });

    const cliente = await prisma.cliente.findUnique({
      where: { id: bot.clienteId }, select: { segmento: true },
    });
    const preset = presetDoSegmento(cliente?.segmento);
    if (!preset) {
      return res.status(400).json({ erro: 'O tenant nao tem segmento definido. Defina o segmento (Servico/Produto/Hibrido) antes de aplicar o preset.' });
    }

    const modulos = new Set(preset.modulosTools);
    const tools = listarTools().filter((t) => modulos.has(t.modulo)).map((t) => t.nome);

    const atualizado = await prisma.bot.update({
      where: { id: bot.id },
      data: {
        toolsHabilitadas: tools,
        promptSistemaIa: preset.promptBase,
        politicasAgente: preset.politicas,
      },
      select: camposBotPublicos,
    });
    res.json({ aplicado: true, segmento: cliente.segmento, totalTools: tools.length, bot: atualizado });
  } catch (erro) {
    console.error('[bots/aplicar-preset]', erro);
    res.status(500).json({ erro: 'Erro ao aplicar preset.' });
  }
});

module.exports = roteador;
