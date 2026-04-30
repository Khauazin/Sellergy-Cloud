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
roteador.use(requerModuloLiberado('AGENDA'));

function tenantFiltro(req) {
  if (ehAdmin(req.usuario)) return {};
  return { clienteId: req.usuario.clienteId };
}

async function agendamentoDoTenant(id, req) {
  const filtro = ehAdmin(req.usuario) ? { id } : { id, clienteId: req.usuario.clienteId };
  return prisma.agendamento.findFirst({ where: filtro, select: { id: true, clienteId: true } });
}

roteador.get('/', requerPermissao('AGENDA', 'visualizar'), async (req, res) => {
  try {
    const { month, year, date } = req.query;
    const where = { ...tenantFiltro(req) };

    if (date) {
      const inicioDia = new Date(date);
      inicioDia.setHours(0, 0, 0, 0);
      const fimDia = new Date(date);
      fimDia.setHours(23, 59, 59, 999);
      where.data = { gte: inicioDia, lte: fimDia };
    } else if (month && year) {
      const inicioMes = new Date(year, month - 1, 1);
      const fimMes = new Date(year, month, 0, 23, 59, 59, 999);
      where.data = { gte: inicioMes, lte: fimMes };
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: {
        lead: {
          select: { nome: true, telefone: true }
        }
      },
      orderBy: { data: 'asc' }
    });

    res.json(agendamentos);
  } catch (erro) {
    console.error('[agenda/list]', erro);
    res.status(500).json({ erro: 'Erro ao carregar agenda' });
  }
});

roteador.post('/', requerPermissao('AGENDA', 'criar'), async (req, res) => {
  try {
    let clienteId = req.usuario.clienteId;
    const {
      leadId, nomeCliente, telefoneCliente, data, duracao,
      servico, preco, observacoes, origem,
      clienteId: bodyClienteId,
    } = req.body;

    // Apenas ADMIN pode criar para outro tenant.
    if (ehAdmin(req.usuario)) {
      if (bodyClienteId) {
        clienteId = bodyClienteId;
      } else if (leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (lead) clienteId = lead.clienteId;
      }
    }

    if (!clienteId) {
      return res.status(403).json({ erro: 'Acao nao permitida.' });
    }

    // Verifica se o leadId, se fornecido, pertence ao mesmo tenant.
    if (leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { clienteId: true } });
      if (!lead || (lead.clienteId !== clienteId && !ehAdmin(req.usuario))) {
        return res.status(400).json({ erro: 'Lead invalido para este tenant.' });
      }
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
    console.error('[agenda/create]', erro);
    res.status(500).json({ erro: 'Erro ao salvar agendamento' });
  }
});

roteador.put('/:id', requerPermissao('AGENDA', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const dados = req.body;

    const existente = await agendamentoDoTenant(id, req);
    if (!existente) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });

    if (dados.data) dados.data = new Date(dados.data);
    if (dados.preco) dados.preco = parseFloat(dados.preco);
    if (dados.duracao) dados.duracao = parseInt(dados.duracao);

    const atualizado = await prisma.agendamento.update({
      where: { id },
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
    console.error('[agenda/update]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar agendamento' });
  }
});

roteador.delete('/:id', requerPermissao('AGENDA', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    const existente = await agendamentoDoTenant(id, req);
    if (!existente) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });

    await prisma.agendamento.delete({ where: { id } });
    res.status(204).send();
  } catch (erro) {
    console.error('[agenda/delete]', erro);
    res.status(500).json({ erro: 'Erro ao excluir agendamento' });
  }
});

roteador.patch('/:id/status', requerPermissao('AGENDA', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ['PENDING', 'CONFIRMED', 'CANCELED', 'COMPLETED'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Status invalido' });
    }

    const existente = await agendamentoDoTenant(id, req);
    if (!existente) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });

    const atualizado = await prisma.agendamento.update({
      where: { id },
      data: { status }
    });

    res.json(atualizado);
  } catch (erro) {
    console.error('[agenda/status]', erro);
    res.status(500).json({ erro: 'Erro ao mudar status' });
  }
});

module.exports = roteador;
