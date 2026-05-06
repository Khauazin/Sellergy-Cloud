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

const { nomesDisponiveis } = require('../agente/tools');
const telegram = require('../canais/telegram');
const { carregarCredencialDecifrada } = require('../credenciais');

// Campos seguros para listagem (sem apiKeyIa).
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
  toolsHabilitadas: true,
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
      select: camposBotPublicos,
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
      apiKeyIa,
    } = req.body;

    // ADMIN pode criar para qualquer tenant; demais sao forcados ao proprio.
    const clienteId = ehAdmin(req.usuario) ? clienteIdBody : req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ erro: 'clienteId eh obrigatorio.' });
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
        apiKeyIa: apiKeyIa || null,
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
      provedorIa, modeloIa, promptSistemaIa, temperaturaIa, apiKeyIa,
    } = req.body;

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
        ...(apiKeyIa !== undefined ? { apiKeyIa } : {}),
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
        variaveis: true
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
        apiKeyIa: botOriginal.apiKeyIa,
        promptSistemaIa: botOriginal.promptSistemaIa,
        temperaturaIa: botOriginal.temperaturaIa,
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
// Telegram: registrar webhook na API do Telegram automaticamente.
// Pega a credencial+verifyTokenCanal do bot e chama setWebhook do
// Telegram apontando pra URL publica deste backend.
// ==========================================
roteador.post('/:id/canal/telegram/registrar-webhook', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const where = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
    const bot = await prisma.bot.findFirst({
      where,
      select: { id: true, clienteId: true, canal: true, credencialCanalId: true, verifyTokenCanal: true },
    });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });
    if (bot.canal !== 'TELEGRAM') return res.status(400).json({ erro: 'Bot nao esta configurado para canal TELEGRAM.' });
    if (!bot.credencialCanalId) return res.status(400).json({ erro: 'Bot sem credencial de canal. Selecione uma credencial TELEGRAM_BOT_TOKEN.' });
    if (!bot.verifyTokenCanal) return res.status(400).json({ erro: 'Bot sem verifyTokenCanal. Gere e salve um antes de registrar.' });

    const { urlPublica } = req.body || {};
    if (!urlPublica || typeof urlPublica !== 'string') {
      return res.status(400).json({ erro: 'urlPublica eh obrigatoria (vem do frontend).' });
    }
    if (!/^https:\/\//i.test(urlPublica)) {
      return res.status(400).json({ erro: 'urlPublica precisa ser HTTPS (Telegram exige).' });
    }

    const credencial = await carregarCredencialDecifrada({
      credencialId: bot.credencialCanalId,
      clienteId: bot.clienteId,
    });
    if (!credencial) return res.status(400).json({ erro: 'Credencial nao encontrada.' });
    if (credencial.tipo !== 'TELEGRAM_BOT_TOKEN') {
      return res.status(400).json({ erro: `Credencial errada: esperado TELEGRAM_BOT_TOKEN, recebido ${credencial.tipo}.` });
    }

    const urlWebhook = `${urlPublica.replace(/\/$/, '')}/canais/telegram/${bot.id}`;
    const resultado = await telegram.registrarWebhook({
      token: credencial.dados.token,
      url: urlWebhook,
      secretToken: bot.verifyTokenCanal,
    });

    res.json({ ok: true, urlWebhook, telegram: resultado });
  } catch (erro) {
    console.error('[bots/telegram/register-webhook]', erro);
    res.status(500).json({ erro: erro?.message || 'Erro ao registrar webhook no Telegram.' });
  }
});

// Consulta webhook atual no Telegram pra mostrar status na UI.
roteador.get('/:id/canal/telegram/webhook-info', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const where = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
    const bot = await prisma.bot.findFirst({
      where,
      select: { id: true, clienteId: true, canal: true, credencialCanalId: true },
    });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });
    if (bot.canal !== 'TELEGRAM') return res.status(400).json({ erro: 'Bot nao esta configurado para canal TELEGRAM.' });
    if (!bot.credencialCanalId) return res.status(400).json({ erro: 'Bot sem credencial de canal.' });

    const credencial = await carregarCredencialDecifrada({
      credencialId: bot.credencialCanalId,
      clienteId: bot.clienteId,
    });
    if (!credencial || credencial.tipo !== 'TELEGRAM_BOT_TOKEN') {
      return res.status(400).json({ erro: 'Credencial invalida.' });
    }

    const info = await telegram.infoWebhook({ token: credencial.dados.token });
    res.json({ info });
  } catch (erro) {
    console.error('[bots/telegram/webhook-info]', erro);
    res.status(500).json({ erro: erro?.message || 'Erro ao consultar webhook.' });
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

module.exports = roteador;
