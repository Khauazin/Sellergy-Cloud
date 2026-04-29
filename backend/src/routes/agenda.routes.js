const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Listar agendamentos do cliente logado
roteador.get('/', async (req, res) => {
  try {
    const { clienteId } = req.usuario;
    const { month, year, date } = req.query;

    if (!clienteId) {
      return res.status(403).json({ erro: 'Apenas clientes podem acessar a agenda' });
    }

    let filtroData = {};

    // Se passou uma data específica (YYYY-MM-DD)
    if (date) {
      const inicioDia = new Date(date);
      inicioDia.setHours(0, 0, 0, 0);
      const fimDia = new Date(date);
      fimDia.setHours(23, 59, 59, 999);
      filtroData = { gte: inicioDia, lte: fimDia };
    }
    // Se passou mês e ano
    else if (month && year) {
      const inicioMes = new Date(year, month - 1, 1);
      const fimMes = new Date(year, month, 0, 23, 59, 59, 999);
      filtroData = { gte: inicioMes, lte: fimMes };
    }

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        clienteId,
        data: filtroData
      },
      include: {
        lead: {
          select: { nome: true, telefone: true }
        }
      },
      orderBy: { data: 'asc' }
    });

    res.json(agendamentos);
  } catch (erro) {
    console.error('Erro ao listar agenda:', erro);
    res.status(500).json({ erro: 'Erro ao carregar agenda' });
  }
});

// Criar novo agendamento
roteador.post('/', async (req, res) => {
  try {
    let { clienteId } = req.usuario;
    const { leadId, nomeCliente, telefoneCliente, data, duracao, servico, preco, observacoes, origem, clienteId: bodyClienteId } = req.body;

    // Se o usuário logado não tem clienteId (é ADMIN), tenta pegar do body ou do leadId
    if (!clienteId && req.usuario.perfil === 'ADMIN') {
      if (bodyClienteId) {
        clienteId = bodyClienteId;
      } else if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) clienteId = lead.clienteId;
      }
    }

    if (!clienteId) {
      return res.status(403).json({ erro: 'Ação não permitida' });
    }

    const novoAgendamento = await prisma.agendamento.create({
      data: {
        clienteId,
        leadId: leadId || null,
        nomeCliente,
        telefoneCliente,
        data: new Date(data),
        duracao: parseInt(duracao) || 30,
        servico,
        preco: parseFloat(preco) || 0,
        observacoes,
        origem: origem || 'MANUAL',
        status: 'PENDING'
      }
    });

    // Se tiver leadId, registra no histórico do Lead
    if (leadId) {
      await prisma.historicoLead.create({
        data: {
          leadId,
          acao: 'EDITADO',
          observacoes: `Novo agendamento criado: ${servico} em ${new Date(data).toLocaleString()}`
        }
      });
    }

    res.status(201).json(novoAgendamento);
  } catch (erro) {
    console.error('Erro ao criar agendamento:', erro);
    res.status(500).json({ erro: 'Erro ao salvar agendamento' });
  }
});

// Atualizar agendamento
roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId } = req.usuario;
    const dados = req.body;

    // Converte datas e números se presentes
    if (dados.data) dados.data = new Date(dados.data);
    if (dados.preco) dados.preco = parseFloat(dados.preco);
    if (dados.duracao) dados.duracao = parseInt(dados.duracao);

    const atualizado = await prisma.agendamento.update({
      where: { id, clienteId },
      data: {
        nomeCliente: dados.nomeCliente,
        telefoneCliente: dados.telefoneCliente,
        data: dados.data,
        duracao: dados.duracao,
        servico: dados.servico,
        preco: dados.preco,
        observacoes: dados.observacoes,
        status: dados.status
      }
    });

    res.json(atualizado);
  } catch (erro) {
    console.error('Erro ao atualizar agendamento:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar agendamento' });
  }
});

// Excluir agendamento
roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId } = req.usuario;

    await prisma.agendamento.delete({
      where: { id, clienteId }
    });

    res.status(204).send();
  } catch (erro) {
    console.error('Erro ao excluir agendamento:', erro);
    res.status(500).json({ erro: 'Erro ao excluir agendamento' });
  }
});

roteador.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId } = req.usuario;
    const { status } = req.body;

    const statusValidos = ['PENDING', 'CONFIRMED', 'CANCELED', 'COMPLETED'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    const atualizado = await prisma.agendamento.update({
      where: { id, clienteId },
      data: { status }
    });

    res.json(atualizado);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao mudar status' });
  }
});

module.exports = roteador;
