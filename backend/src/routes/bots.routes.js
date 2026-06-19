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

// Pós-pivô ERP-first: o Bot deixou de ter agente de IA, fluxo e tools. Sobrou a
// "casca de conexão" do WhatsApp (canal + credencial + verify token). O
// agendamento/atendimento/campanha automatizados (sem IA) serão remontados nas
// fases seguintes. Ver erp-pivo.md §5/§7 e erp-arquitetura-e-operacao.md §6.
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
  credencialCanalId: true,
  identificadorCanal: true,
  verifyTokenCanal: true,
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
    const { clienteId: clienteIdBody, nome, canal, telefone } = req.body;

    // ADMIN pode criar para qualquer tenant; demais sao forcados ao proprio.
    const clienteId = ehAdmin(req.usuario) ? clienteIdBody : req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ erro: 'clienteId eh obrigatorio.' });
    }

    const bot = await prisma.bot.create({
      data: { clienteId, nome, canal, telefone },
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

    const { nome, canal, status, telefone } = req.body;

    const bot = await prisma.bot.update({
      where: { id },
      data: { nome, canal, status, telefone },
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
      include: { variaveis: true },
    });

    if (!botOriginal) return res.status(404).json({ erro: 'Bot nao encontrado' });

    const novoBot = await prisma.bot.create({
      data: {
        clienteId: botOriginal.clienteId,
        nome: `${botOriginal.nome} (Copia)`,
        canal: botOriginal.canal,
        telefone: botOriginal.telefone,
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
// Configuracao de canal externo (conexão WhatsApp).
// Body: { credencialCanalId?, identificadorCanal?, verifyTokenCanal?, canal? }
// ==========================================
roteador.patch('/:id/canal', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const where = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
    const bot = await prisma.bot.findFirst({ where, select: { id: true, clienteId: true } });
    if (!bot) return res.status(404).json({ erro: 'Bot nao encontrado.' });

    const { credencialCanalId, identificadorCanal, verifyTokenCanal, canal } = req.body || {};
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

module.exports = roteador;
