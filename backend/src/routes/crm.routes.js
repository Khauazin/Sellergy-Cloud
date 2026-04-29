const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// ==========================================
// LEAD STAGES (Fases do Kanban)
// ==========================================

roteador.get('/stages', async (req, res) => {
  try {
    let { clienteId } = req.usuario;
    const { clienteId: queryClienteId } = req.query;

    if (!clienteId && req.usuario.perfil === 'ADMIN') {
      clienteId = queryClienteId;
    }

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId é obrigatório' });
    }

    const stages = await prisma.etapaLead.findMany({
      where: { clienteId },
      orderBy: { ordem: 'asc' }
    });
    res.json(stages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar fases do CRM' });
  }
});

roteador.post('/stages', async (req, res) => {
  try {
    let { clienteId } = req.usuario;
    const { nome, ordem, cor, clienteId: bodyClienteId } = req.body;

    // Se o usuário logado não tem clienteId (é ADMIN), tenta pegar do body
    if (!clienteId && req.usuario.perfil === 'ADMIN') {
      clienteId = bodyClienteId;
    }

    console.log(`[CRM] Criando stage "${nome}" para cliente ${clienteId}`);

    if (!clienteId) {
      console.error('[CRM] Tentativa de criar stage sem clienteId');
      return res.status(400).json({ error: 'clienteId é obrigatório para criar fase' });
    }

    const stage = await prisma.etapaLead.create({
      data: { clienteId, nome, ordem: parseInt(ordem) || 0, cor }
    });
    res.status(201).json(stage);
  } catch (error) {
    console.error('[CRM] Erro ao criar fase:', error);
    res.status(500).json({ error: 'Erro ao criar fase no CRM' });
  }
});

roteador.put('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId } = req.usuario;
    const { nome, ordem, cor } = req.body;
    const stage = await prisma.etapaLead.update({
      where: { id, clienteId },
      data: { nome, ordem: parseInt(ordem) || undefined, cor }
    });
    res.json(stage);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar fase do CRM' });
  }
});

roteador.delete('/stages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clienteId } = req.usuario;
    await prisma.etapaLead.delete({ where: { id, clienteId } });
    res.json({ message: 'Fase excluída com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir fase' });
  }
});

// ==========================================
// LEADS
// ==========================================

roteador.get('/leads', async (req, res) => {
  try {
    let { clienteId } = req.usuario;
    const { clienteId: queryClienteId } = req.query;

    if (!clienteId && req.usuario.perfil === 'ADMIN') {
      clienteId = queryClienteId;
    }

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId é obrigatório' });
    }

    const leads = await prisma.lead.findMany({
      where: { clienteId },
      include: { etapa: true },
      orderBy: { atualizadoEm: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar leads' });
  }
});

roteador.post('/leads', async (req, res) => {
  try {
    let { clienteId } = req.usuario;
    const { etapaId, nome, telefone, email, valor, tags, prioridade, origem, observacoes, clienteId: bodyClienteId } = req.body;

    // Se o usuário logado não tem clienteId (é ADMIN), tenta pegar do body
    if (!clienteId && req.usuario.perfil === 'ADMIN') {
      clienteId = bodyClienteId;
    }

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId é obrigatório para criar lead' });
    }

    const lead = await prisma.lead.create({
      data: { clienteId, etapaId, nome, telefone, email, valor: parseFloat(valor) || 0, tags, prioridade, origem, observacoes },
      include: { etapa: true }
    });

    try {
      await prisma.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'CRIADO',
          paraEtapa: lead.etapa?.nome || 'Início',
          observacoes: `Lead "${nome}" criado`
        }
      });
    } catch (e) { console.error('Erro Histórico:', e); }

    res.status(201).json(lead);
  } catch (error) {
    console.error('Erro Create Lead:', error);
    res.status(500).json({ error: 'Erro ao criar lead' });
  }
});

roteador.put('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { clienteId } = req.usuario;
    const { etapaId, nome, telefone, email, valor, tags, prioridade, origem, observacoes, clienteId: bodyClienteId } = req.body;

    // Se for ADMIN, ele pode estar editando um lead de qualquer cliente.
    const anterior = await prisma.lead.findUnique({ where: { id }, include: { etapa: true } });

    if (!anterior) return res.status(404).json({ error: 'Lead não encontrado' });

    // Permissão: Admin pode tudo, Cliente só o dele.
    if (req.usuario.perfil !== 'ADMIN' && anterior.clienteId !== clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { 
        etapaId, nome, telefone, email, 
        valor: parseFloat(valor) || 0, 
        tags, prioridade, origem, observacoes,
        clienteId: req.usuario.perfil === 'ADMIN' ? (bodyClienteId || anterior.clienteId) : anterior.clienteId
      },
      include: { etapa: true }
    });

    if (anterior && anterior.etapaId !== etapaId) {
      try {
        await prisma.historicoLead.create({
          data: {
            leadId: id,
            acao: 'MOVIDO',
            deEtapa: anterior.etapa?.nome || 'N/A',
            paraEtapa: lead.etapa?.nome || 'N/A',
            observacoes: `Movido para ${lead.etapa?.nome || 'nova etapa'}`
          }
        });
      } catch (e) { console.error('Erro Histórico Move:', e); }
    }

    res.json(lead);
  } catch (error) {
    console.error('Erro Update Lead:', error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

roteador.delete('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { clienteId } = req.usuario;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    if (req.usuario.perfil !== 'ADMIN' && lead.clienteId !== clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await prisma.lead.delete({ where: { id } });
    res.json({ message: 'Lead excluído com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir lead' });
  }
});

// ==========================================
// HISTÓRICO DO LEAD
// ==========================================

roteador.get('/leads/:leadId/history', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { clienteId } = req.usuario;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.json([]);

    if (req.usuario.perfil !== 'ADMIN' && lead.clienteId !== clienteId) {
      return res.json([]);
    }

    const history = await prisma.historicoLead.findMany({
      where: { leadId },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(history);
  } catch (error) {
    res.json([]);
  }
});

roteador.post('/leads/:leadId/history', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { clienteId } = req.usuario;
    const { observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    if (req.usuario.perfil !== 'ADMIN' && lead.clienteId !== clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const entry = await prisma.historicoLead.create({
      data: { leadId, acao: 'OBSERVACAO', observacoes }
    });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar observação' });
  }
});

module.exports = roteador;
