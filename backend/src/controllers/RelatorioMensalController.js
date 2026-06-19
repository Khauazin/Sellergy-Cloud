// Controller de Relatórios Mensais (snapshot persistido).
// Tenant isolation rigoroso — toda query filtra por clienteId do JWT.

const prisma = require('../prisma');
const { gerarSnapshot, mesAnterior } = require('../jobs/gerarRelatorioMensal');

class RelatorioMensalController {

  // GET /relatorios-mensais — lista os snapshots disponíveis (mais recentes primeiro)
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const itens = await prisma.relatorioMensal.findMany({
        where: { clienteId },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
        select: {
          id: true, ano: true, mes: true, geradoEm: true, geradoPor: true,
        },
      });
      res.json(itens);
    } catch (e) {
      console.error('[relatorioMensal/listar]', e?.message);
      res.status(500).json({ error: 'Erro ao listar relatórios mensais.' });
    }
  }

  // GET /relatorios-mensais/:ano/:mes
  async detalhe(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });

      const ano = parseInt(req.params.ano, 10);
      const mes = parseInt(req.params.mes, 10);
      if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(422).json({ error: 'Ano ou mês inválido.' });
      }

      const r = await prisma.relatorioMensal.findUnique({
        where: { clienteId_ano_mes: { clienteId, ano, mes } },
      });
      if (!r) return res.status(404).json({ error: 'Relatório não encontrado para esse mês.' });
      res.json(r);
    } catch (e) {
      console.error('[relatorioMensal/detalhe]', e?.message);
      res.status(500).json({ error: 'Erro ao buscar relatório.' });
    }
  }

  // POST /relatorios-mensais/gerar — força geração agora.
  // Body opcional: { ano, mes }. Sem corpo, usa o mês anterior.
  // Só CLIENT e ADMINISTRADOR podem disparar.
  async gerarManual(req, res) {
    try {
      const { clienteId, id: usuarioId, perfil } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado.' });
      if (perfil !== 'CLIENT' && perfil !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Apenas o dono ou administrador pode gerar manualmente.' });
      }

      let ano = parseInt(req.body?.ano, 10);
      let mes = parseInt(req.body?.mes, 10);
      if (!Number.isInteger(ano) || !Number.isInteger(mes)) {
        const anterior = mesAnterior();
        ano = anterior.ano;
        mes = anterior.mes;
      }
      if (mes < 1 || mes > 12) {
        return res.status(422).json({ error: 'Mês inválido.' });
      }

      const r = await gerarSnapshot({ clienteId, ano, mes, geradoPor: usuarioId });
      res.status(201).json(r);
    } catch (e) {
      console.error('[relatorioMensal/gerarManual]', e?.message);
      res.status(500).json({ error: 'Erro ao gerar relatório.' });
    }
  }
}

module.exports = new RelatorioMensalController();
