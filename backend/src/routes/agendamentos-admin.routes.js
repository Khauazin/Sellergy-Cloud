// CRUD de agendamentos (trigger SCHEDULE) — autenticado, multi-tenant.
const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const {
  validarExpressaoCron,
  proximoDisparo,
  sincronizarAgendamento,
} = require('../agendamento');
const { removerRepeatableAgendamento } = require('../filas');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('BOTS'));

const FUSO_HORARIO_PADRAO = 'America/Sao_Paulo';

async function fluxoDoTenant(fluxoId, usuario) {
  const where = ehAdmin(usuario)
    ? { id: fluxoId }
    : { id: fluxoId, bot: { clienteId: usuario.clienteId } };
  return prisma.fluxo.findFirst({ where, select: { id: true } });
}

async function agendamentoDoTenant(id, usuario) {
  const where = ehAdmin(usuario)
    ? { id }
    : { id, fluxo: { bot: { clienteId: usuario.clienteId } } };
  return prisma.agendamentoFluxo.findFirst({ where });
}

// GET /agendamentos-admin/fluxo/:fluxoId
roteador.get('/fluxo/:fluxoId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;
    if (!(await fluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }
    const ags = await prisma.agendamentoFluxo.findMany({
      where: { fluxoId },
      orderBy: { criadoEm: 'asc' },
    });
    res.json(ags);
  } catch (erro) {
    console.error('[agendamentos/listar]', erro);
    res.status(500).json({ erro: 'Erro ao listar agendamentos.' });
  }
});

// GET /agendamentos-admin/no/:noId
roteador.get('/no/:noId', requerPermissao('BOTS', 'visualizar'), async (req, res) => {
  try {
    const { noId } = req.params;
    const where = ehAdmin(req.usuario)
      ? { noId }
      : { noId, fluxo: { bot: { clienteId: req.usuario.clienteId } } };
    const ag = await prisma.agendamentoFluxo.findFirst({ where });
    if (!ag) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });
    res.json(ag);
  } catch (erro) {
    console.error('[agendamentos/por-no]', erro);
    res.status(500).json({ erro: 'Erro ao buscar agendamento.' });
  }
});

// POST /agendamentos-admin/fluxo/:fluxoId  body: { noId, expressaoCron, fusoHorario? }
roteador.post('/fluxo/:fluxoId', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { fluxoId } = req.params;
    if (!(await fluxoDoTenant(fluxoId, req.usuario))) {
      return res.status(404).json({ erro: 'Fluxo nao encontrado.' });
    }

    const { noId, expressaoCron, fusoHorario } = req.body || {};
    if (typeof noId !== 'string' || !noId) {
      return res.status(400).json({ erro: 'Campo "noId" e obrigatorio.' });
    }
    if (typeof expressaoCron !== 'string' || !expressaoCron) {
      return res.status(400).json({ erro: 'Campo "expressaoCron" e obrigatorio.' });
    }

    const tz = typeof fusoHorario === 'string' && fusoHorario ? fusoHorario : FUSO_HORARIO_PADRAO;
    const valid = validarExpressaoCron(expressaoCron.trim(), tz);
    if (!valid.valido) return res.status(400).json({ erro: valid.erro });

    const no = await prisma.no.findFirst({ where: { id: noId, fluxoId } });
    if (!no) return res.status(400).json({ erro: 'No nao pertence ao fluxo.' });
    if (no.tipo !== 'SCHEDULE') {
      return res.status(400).json({ erro: 'Apenas nos do tipo SCHEDULE podem ter agendamento.' });
    }

    const existente = await prisma.agendamentoFluxo.findUnique({ where: { noId } });
    if (existente) return res.status(200).json(existente);

    const agendamento = await prisma.agendamentoFluxo.create({
      data: {
        fluxoId,
        noId,
        expressaoCron: expressaoCron.trim(),
        fusoHorario: tz,
        proximoDisparoEm: proximoDisparo(expressaoCron.trim(), tz),
      },
    });

    await sincronizarAgendamento(agendamento);
    res.status(201).json(agendamento);
  } catch (erro) {
    console.error('[agendamentos/criar]', erro);
    res.status(500).json({ erro: 'Erro ao criar agendamento.' });
  }
});

// PATCH /agendamentos-admin/:id  body: { ativo?, expressaoCron?, fusoHorario? }
roteador.patch('/:id', requerPermissao('BOTS', 'editar'), async (req, res) => {
  try {
    const { id } = req.params;
    const ag = await agendamentoDoTenant(id, req.usuario);
    if (!ag) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });

    const { ativo, expressaoCron, fusoHorario } = req.body || {};
    const dados = {};

    if (ativo !== undefined) {
      if (typeof ativo !== 'boolean') return res.status(400).json({ erro: '"ativo" deve ser booleano.' });
      dados.ativo = ativo;
    }
    if (expressaoCron !== undefined) {
      if (typeof expressaoCron !== 'string' || !expressaoCron.trim()) {
        return res.status(400).json({ erro: 'expressaoCron invalida.' });
      }
      dados.expressaoCron = expressaoCron.trim();
    }
    if (fusoHorario !== undefined) {
      if (typeof fusoHorario !== 'string' || !fusoHorario) {
        return res.status(400).json({ erro: 'fusoHorario invalido.' });
      }
      dados.fusoHorario = fusoHorario;
    }
    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });
    }

    const tzFinal = dados.fusoHorario || ag.fusoHorario;
    const cronFinal = dados.expressaoCron || ag.expressaoCron;

    if (dados.expressaoCron || dados.fusoHorario) {
      const valid = validarExpressaoCron(cronFinal, tzFinal);
      if (!valid.valido) return res.status(400).json({ erro: valid.erro });
      dados.proximoDisparoEm = proximoDisparo(cronFinal, tzFinal);
    }

    const atualizado = await prisma.agendamentoFluxo.update({ where: { id }, data: dados });
    await sincronizarAgendamento(atualizado);
    res.json(atualizado);
  } catch (erro) {
    console.error('[agendamentos/atualizar]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar agendamento.' });
  }
});

// DELETE /agendamentos-admin/:id
roteador.delete('/:id', requerPermissao('BOTS', 'excluir'), async (req, res) => {
  try {
    const { id } = req.params;
    const ag = await agendamentoDoTenant(id, req.usuario);
    if (!ag) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });

    await prisma.agendamentoFluxo.delete({ where: { id } });
    await removerRepeatableAgendamento({ agendamentoId: id });
    res.json({ mensagem: 'Agendamento excluido.' });
  } catch (erro) {
    console.error('[agendamentos/excluir]', erro);
    res.status(500).json({ erro: 'Erro ao excluir agendamento.' });
  }
});

module.exports = roteador;
