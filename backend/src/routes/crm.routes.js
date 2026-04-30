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
roteador.use(requerModuloLiberado('CRM'));

function tenantDoSolicitante(req, queryClienteId) {
  if (ehAdmin(req.usuario)) return queryClienteId || null;
  return req.usuario.clienteId || null;
}

// ==========================================
// LEAD STAGES (Fases do Kanban)
// ==========================================

roteador.get('/stages', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = tenantDoSolicitante(req, req.query.clienteId);
    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio' });
    }

    const stages = await prisma.etapaLead.findMany({
      where: { clienteId },
      orderBy: { ordem: 'asc' }
    });
    res.json(stages);
  } catch (error) {
    console.error('[crm/stages-list]', error);
    res.status(500).json({ error: 'Erro ao buscar fases do CRM' });
  }
});

roteador.post('/stages', requerPermissao('CRM', 'criar'), async (req, res) => {
  try {
    const { nome, ordem, cor, clienteId: bodyClienteId } = req.body;
    const clienteId = tenantDoSolicitante(req, bodyClienteId);

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio para criar fase' });
    }

    const stage = await prisma.etapaLead.create({
      data: { clienteId, nome, ordem: parseInt(ordem) || 0, cor }
    });
    res.status(201).json(stage);
  } catch (error) {
    console.error('[crm/stage-create]', error);
    res.status(500).json({ error: 'Erro ao criar fase no CRM' });
  }
});

roteador.put('/stages/:id', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ordem, cor } = req.body;

    // Verifica posse do stage antes de atualizar.
    const stageOriginal = await prisma.etapaLead.findUnique({ where: { id } });
    if (!stageOriginal) return res.status(404).json({ error: 'Fase nao encontrada.' });

    if (!ehAdmin(req.usuario) && stageOriginal.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    const stage = await prisma.etapaLead.update({
      where: { id },
      data: { nome, ordem: parseInt(ordem) || undefined, cor }
    });
    res.json(stage);
  } catch (error) {
    console.error('[crm/stage-update]', error);
    res.status(500).json({ error: 'Erro ao atualizar fase do CRM' });
  }
});

roteador.delete('/stages/:id', requerPermissao('CRM', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    const stageOriginal = await prisma.etapaLead.findUnique({ where: { id } });
    if (!stageOriginal) return res.status(404).json({ error: 'Fase nao encontrada.' });

    if (!ehAdmin(req.usuario) && stageOriginal.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

    await prisma.etapaLead.delete({ where: { id } });
    res.json({ message: 'Fase excluida com sucesso' });
  } catch (error) {
    console.error('[crm/stage-delete]', error);
    res.status(500).json({ error: 'Erro ao excluir fase' });
  }
});

// ==========================================
// LEADS
// ==========================================

roteador.get('/leads', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = tenantDoSolicitante(req, req.query.clienteId);
    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio' });
    }

    const leads = await prisma.lead.findMany({
      where: { clienteId },
      include: { etapa: true },
      orderBy: { atualizadoEm: 'desc' }
    });
    res.json(leads);
  } catch (error) {
    console.error('[crm/leads-list]', error);
    res.status(500).json({ error: 'Erro ao buscar leads' });
  }
});

roteador.post('/leads', requerPermissao('CRM', 'criar'), async (req, res) => {
  try {
    const {
      etapaId, nome, telefone, email, valor, tags, prioridade, origem, observacoes,
      clienteId: bodyClienteId,
    } = req.body;
    const clienteId = tenantDoSolicitante(req, bodyClienteId);

    if (!clienteId) {
      return res.status(400).json({ error: 'clienteId eh obrigatorio para criar lead' });
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
          paraEtapa: lead.etapa?.nome || 'Inicio',
          observacoes: `Lead "${nome}" criado`
        }
      });
    } catch (e) { console.error('Erro Historico:', e); }

    res.status(201).json(lead);
  } catch (error) {
    console.error('[crm/leads-create]', error);
    res.status(500).json({ error: 'Erro ao criar lead' });
  }
});

roteador.put('/leads/:id', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      etapaId, nome, telefone, email, valor, tags, prioridade, origem, observacoes,
      clienteId: bodyClienteId,
    } = req.body;

    const anterior = await prisma.lead.findUnique({ where: { id }, include: { etapa: true } });
    if (!anterior) return res.status(404).json({ error: 'Lead nao encontrado' });

    if (!ehAdmin(req.usuario) && anterior.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        etapaId, nome, telefone, email,
        valor: parseFloat(valor) || 0,
        tags, prioridade, origem, observacoes,
        clienteId: ehAdmin(req.usuario) ? (bodyClienteId || anterior.clienteId) : anterior.clienteId
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
      } catch (e) { console.error('Erro Historico Move:', e); }
    }

    res.json(lead);
  } catch (error) {
    console.error('[crm/leads-update]', error);
    res.status(500).json({ error: 'Erro ao atualizar lead' });
  }
});

roteador.delete('/leads/:id', requerPermissao('CRM', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });

    if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await prisma.lead.delete({ where: { id } });
    res.json({ message: 'Lead excluido com sucesso' });
  } catch (error) {
    console.error('[crm/leads-delete]', error);
    res.status(500).json({ error: 'Erro ao excluir lead' });
  }
});

// ==========================================
// HISTORICO DO LEAD
// ==========================================

roteador.get('/leads/:leadId/history', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const { leadId } = req.params;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.json([]);

    if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
      return res.json([]);
    }

    const history = await prisma.historicoLead.findMany({
      where: { leadId },
      orderBy: { criadoEm: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error('[crm/leads-history]', error);
    res.json([]);
  }
});

roteador.post('/leads/:leadId/history', requerPermissao('CRM', 'editar'), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { observacoes } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead nao encontrado' });

    if (!ehAdmin(req.usuario) && lead.clienteId !== req.usuario.clienteId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const entry = await prisma.historicoLead.create({
      data: { leadId, acao: 'OBSERVACAO', observacoes }
    });
    res.status(201).json(entry);
  } catch (error) {
    console.error('[crm/leads-history-create]', error);
    res.status(500).json({ error: 'Erro ao adicionar observacao' });
  }
});

module.exports = roteador;
