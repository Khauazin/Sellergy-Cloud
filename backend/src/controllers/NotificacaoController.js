// =====================================================================
// Controlador de Notificações (sino + preferências de opt-in)
// =====================================================================
// Tenant isolation: toda consulta filtra por `clienteId` do JWT, e quando
// `usuarioId` está presente, também filtra pelo `req.usuario.id`. Garante
// que ninguém vê notificação de outro tenant nem de outro usuário do
// mesmo tenant.

const prisma = require('../prisma');
const { TIPOS_VALIDOS } = require('../utils/notificacoes');

class NotificacaoController {

  // GET /notificacoes?limite=30&apenasNaoLidas=true
  // Lista do usuário atual + as não-direcionadas (usuarioId=null) do tenant.
  async listar(req, res) {
    try {
      const { id: usuarioId, clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const limite = Math.min(parseInt(req.query.limite, 10) || 30, 100);
      const apenasNaoLidas = req.query.apenasNaoLidas === 'true';

      const where = {
        clienteId,
        OR: [
          { usuarioId },
          { usuarioId: null },
        ],
      };
      if (apenasNaoLidas) where.lida = false;

      const [itens, totalNaoLidas] = await Promise.all([
        prisma.notificacao.findMany({
          where,
          orderBy: { criadoEm: 'desc' },
          take: limite,
        }),
        prisma.notificacao.count({
          where: {
            clienteId,
            OR: [{ usuarioId }, { usuarioId: null }],
            lida: false,
          },
        }),
      ]);

      res.json({ itens, totalNaoLidas });
    } catch (e) {
      console.error('[notificacoes/listar]', e?.message);
      res.status(500).json({ error: 'Erro ao listar notificações.' });
    }
  }

  // PATCH /notificacoes/:id/lida — marca uma como lida
  async marcarLida(req, res) {
    try {
      const { id: usuarioId, clienteId } = req.usuario;
      const { id } = req.params;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      // Confere posse antes de atualizar (tenant + (usuário ou broadcast))
      const notif = await prisma.notificacao.findFirst({
        where: {
          id,
          clienteId,
          OR: [{ usuarioId }, { usuarioId: null }],
        },
      });
      if (!notif) return res.status(404).json({ error: 'Notificação não encontrada.' });

      const atualizada = await prisma.notificacao.update({
        where: { id },
        data: { lida: true, lidaEm: new Date() },
      });
      res.json(atualizada);
    } catch (e) {
      console.error('[notificacoes/marcarLida]', e?.message);
      res.status(500).json({ error: 'Erro ao marcar notificação.' });
    }
  }

  // PATCH /notificacoes/todas-lidas — marca todas do usuário como lidas
  async marcarTodasLidas(req, res) {
    try {
      const { id: usuarioId, clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const r = await prisma.notificacao.updateMany({
        where: {
          clienteId,
          OR: [{ usuarioId }, { usuarioId: null }],
          lida: false,
        },
        data: { lida: true, lidaEm: new Date() },
      });
      res.json({ atualizadas: r.count });
    } catch (e) {
      console.error('[notificacoes/marcarTodasLidas]', e?.message);
      res.status(500).json({ error: 'Erro ao marcar todas as notificações.' });
    }
  }

  // GET /notificacoes/preferencias — lista preferências do usuário atual.
  // Retorna todos os tipos válidos com status (default ativo se nunca configurado).
  async listarPreferencias(req, res) {
    try {
      const { id: usuarioId, clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const salvas = await prisma.preferenciaNotificacao.findMany({
        where: { usuarioId },
      });
      const mapaSalvas = new Map(salvas.map((p) => [p.tipo, p.ativa]));

      const itens = Array.from(TIPOS_VALIDOS).map((tipo) => ({
        tipo,
        ativa: mapaSalvas.has(tipo) ? mapaSalvas.get(tipo) : true,
      }));

      res.json(itens);
    } catch (e) {
      console.error('[notificacoes/listarPreferencias]', e?.message);
      res.status(500).json({ error: 'Erro ao listar preferências.' });
    }
  }

  // PUT /notificacoes/preferencias/:tipo — { ativa: bool }
  async atualizarPreferencia(req, res) {
    try {
      const { id: usuarioId, clienteId } = req.usuario;
      const { tipo } = req.params;
      const { ativa } = req.body;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });
      if (!TIPOS_VALIDOS.has(tipo)) return res.status(422).json({ error: 'Tipo inválido.' });
      if (typeof ativa !== 'boolean') return res.status(422).json({ error: 'Campo "ativa" precisa ser true ou false.' });

      const pref = await prisma.preferenciaNotificacao.upsert({
        where: { usuarioId_tipo: { usuarioId, tipo } },
        create: { usuarioId, tipo, ativa },
        update: { ativa },
      });
      res.json(pref);
    } catch (e) {
      console.error('[notificacoes/atualizarPreferencia]', e?.message);
      res.status(500).json({ error: 'Erro ao salvar preferência.' });
    }
  }
}

module.exports = new NotificacaoController();
