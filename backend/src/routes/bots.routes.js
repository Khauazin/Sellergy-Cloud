const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', async (req, res) => {
  try {
    const bots = await prisma.bot.findMany({
      include: { cliente: { select: { nome: true } } },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(bots);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar bots' });
  }
});

roteador.get('/:id', async (req, res) => {
  try {
    const bot = await prisma.bot.findUnique({
      where: { id: req.params.id }
    });
    if (!bot) return res.status(404).json({ erro: 'Bot não encontrado' });
    res.json(bot);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar bot' });
  }
});

roteador.post('/', async (req, res) => {
  try {
    const { clienteId, nome, canal, telefone, provedorIa, modeloIa, promptSistemaIa, temperaturaIa } = req.body;
    const bot = await prisma.bot.create({
      data: { 
        clienteId, 
        nome, 
        canal, 
        telefone, 
        provedorIa, 
        modeloIa, 
        promptSistemaIa, 
        temperaturaIa: temperaturaIa ? parseFloat(temperaturaIa) : 0.7 
      }
    });
    res.status(201).json(bot);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar bot' });
  }
});

roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, canal, status, telefone, provedorIa, modeloIa, promptSistemaIa, temperaturaIa, apiKeyIa } = req.body;
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
        apiKeyIa, 
        temperaturaIa: temperaturaIa ? parseFloat(temperaturaIa) : 0.7 
      }
    });
    
    // Avisar todos os clientes via socket que o bot atualizou
    if (req.io) req.io.emit('bot_atualizado', bot);
    
    res.json(bot);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar bot' });
  }
});

roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.bot.delete({ where: { id } });
    if (req.io) req.io.emit('bot_deletado', id);
    res.json({ message: 'Bot excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir bot.' });
  }
});

roteador.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Busca o bot original completo
    const botOriginal = await prisma.bot.findUnique({
      where: { id },
      include: {
        fluxos: {
          include: {
            nos: true,
            conexoes: true
          }
        },
        variaveis: true
      }
    });

    if (!botOriginal) return res.status(404).json({ erro: 'Bot não encontrado' });

    // 2. Clona o Bot Base
    const novoBot = await prisma.bot.create({
      data: {
        clienteId: botOriginal.clienteId,
        nome: `${botOriginal.nome} (Cópia)`,
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

    // 3. Clona as Variáveis
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

    // 4. Clona os Fluxos e seus nós/conexoes
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

    // Notifica frontend
    const botCompleto = await prisma.bot.findUnique({
      where: { id: novoBot.id },
      include: { cliente: { select: { nome: true } } }
    });
    
    if (req.io) req.io.emit('bot_criado', botCompleto);
    
    res.status(201).json(botCompleto);
  } catch (error) {
    console.error('Erro ao duplicar bot:', error);
    res.status(500).json({ error: 'Erro ao duplicar o bot.' });
  }
});

module.exports = roteador;
