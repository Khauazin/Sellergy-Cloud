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

module.exports = roteador;
