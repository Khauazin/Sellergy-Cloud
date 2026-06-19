// Campanhas — v1: RECOMPRA POR CADENCIA (recompra leve).
//
// O plano define campanhas completas (disparo HSM em massa, templates Meta)
// como fase 2 do produto — depende de aprovacao de template pela Meta e da
// infra de envio. Aqui entregamos o nucleo nao-bloqueado e de valor imediato:
// a FILA DE RECOMPRA. Calcula quem comprou ha >= N dias e nao voltou, pra a
// equipe agir manualmente (abrir conversa no WhatsApp). Nada e disparado
// automaticamente nesta versao.
//
// Gating: modulo CRM (recompra e relacionamento/funil) + permissao CRM.

const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('CRM'));

const MS_DIA = 24 * 60 * 60 * 1000;
const DIAS_PADRAO = 30;
const DIAS_MIN = 1;
const DIAS_MAX = 365;

// GET /campanhas/recompra?dias=30
// Candidatos: leads cuja ULTIMA compra (venda COMPLETED) foi ha >= `dias` dias
// e que nao compraram de novo desde entao. Ordena do mais "vencido" ao mais
// recente. v1: lista pra acao manual; nao dispara mensagem.
roteador.get('/recompra', requerPermissao('CRM', 'visualizar'), async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ erro: 'Apenas usuarios de um tenant acessam a recompra.' });
    }

    const diasBruto = parseInt(req.query.dias, 10);
    const dias = Math.min(Math.max(Number.isFinite(diasBruto) ? diasBruto : DIAS_PADRAO, DIAS_MIN), DIAS_MAX);
    const corte = new Date(Date.now() - dias * MS_DIA);

    // Ultima compra por lead (so vendas concluidas, com lead vinculado).
    const grupos = await prisma.venda.groupBy({
      by: ['leadId'],
      where: { clienteId, status: 'COMPLETED', leadId: { not: null } },
      _max: { data: true },
      _count: { _all: true },
      _sum: { valor: true },
    });

    // Vencidos: ultima compra <= corte (nao voltaram dentro da janela).
    const vencidos = grupos.filter((g) => g._max.data && new Date(g._max.data) <= corte);
    const leadIds = vencidos.map((g) => g.leadId);
    if (leadIds.length === 0) {
      return res.json({ dias, corte, candidatos: [] });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, clienteId },
      select: { id: true, nome: true, telefone: true, ultimoContato: true },
    });
    const mapaLead = new Map(leads.map((l) => [l.id, l]));

    const candidatos = vencidos
      .map((g) => {
        const lead = mapaLead.get(g.leadId);
        if (!lead) return null;
        const ultimaCompra = g._max.data;
        const diasDesde = Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / MS_DIA);
        return {
          leadId: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          ultimaCompra,
          diasDesde,
          totalCompras: g._count._all,
          valorTotal: g._sum.valor || 0,
          // Pra UI sinalizar quem ja foi contatado depois da ultima compra.
          ultimoContato: lead.ultimoContato,
          contatadoAposCompra: lead.ultimoContato ? new Date(lead.ultimoContato) > new Date(ultimaCompra) : false,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.diasDesde - a.diasDesde);

    res.json({ dias, corte, candidatos });
  } catch (erro) {
    console.error('[campanhas/recompra]', erro);
    res.status(500).json({ erro: 'Erro ao calcular a fila de recompra.' });
  }
});

module.exports = roteador;
