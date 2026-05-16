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
  return prisma.agendamento.findFirst({
    where: filtro,
    select: { id: true, clienteId: true, data: true, status: true },
  });
}

// =====================================================================
// REGRA DE IMUTABILIDADE
// =====================================================================
// Agendamento e considerado imutavel quando:
//   1. A data ja passou (data < hoje 00:00 BRT) E
//   2. O status nao e PENDING (ou seja, alguem ja atualizou pra
//      CONFIRMED, COMPLETED ou CANCELED)
//
// Justificativa: PENDING sao agendas "esquecidas" — permitimos atualizar
// status retroativamente (ex: marcar como concluido depois). Mas uma vez
// atualizado, vira historico imutavel pra evitar adulteracao de dados
// passados (relatorios, financeiro).
//
// IMPORTANTE — TZ: como o sistema e Brasil-only, hardcode TZ BRT (UTC-3,
// sem DST desde 2019). Sem isso, servidor rodando em UTC marcava um item
// de 22:00 BRT (= ja "ontem" pro usuario) como ainda "hoje".

// Retorna o Date que representa 00:00 BRT do dia atual (em UTC).
function inicioDoDiaBRT() {
  // pt-BR formatado em America/Sao_Paulo da YYYY-MM-DD do dia atual no BRT
  const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  // 00:00 BRT = 03:00 UTC (offset fixo -03:00).
  return new Date(`${hojeStr}T03:00:00.000Z`);
}

function ehImutavel(ag) {
  if (!ag) return false;
  if (ag.status === 'PENDING') return false;
  return new Date(ag.data) < inicioDoDiaBRT();
}

function bloqueioImutavel(res) {
  return res.status(423).json({
    erro: 'Agendamento bloqueado: itens passados com status atualizado ficam imutaveis pra preservar o historico.',
    codigo: 'IMUTAVEL',
  });
}

// =====================================================================
// LOG DE AUDITORIA
// =====================================================================
// Registra cada mudanca em agendamento. Best-effort: se falhar nao quebra
// a operacao principal. usuarioId/Nome sao snapshot (preservam mesmo se
// usuario for deletado depois).
//
// alteracoes (so pra EDITADO/STATUS_MUDADO): { campo: { de, para } }
async function logHistorico({ agendamentoId, acao, alteracoes = null, req, origem = null }) {
  try {
    await prisma.historicoAgendamento.create({
      data: {
        agendamentoId,
        acao,
        alteracoes,
        usuarioId: req?.usuario?.id || null,
        usuarioNome: req?.usuario?.nome || null,
        origem,
      },
    });
  } catch (e) {
    console.error('[agenda/historico] falha ao logar', e?.message);
  }
}

// Calcula o diff entre o estado antes e o body recebido. Retorna so os
// campos que mudaram. Ignora campos undefined no body (nao foram enviados).
function calcularAlteracoes(antes, depois, campos) {
  const diff = {};
  for (const campo of campos) {
    if (depois[campo] === undefined) continue;
    const valorAntes = antes[campo];
    const valorDepois = depois[campo];
    // Normaliza Date pra string ISO pra comparacao limpa.
    const a = valorAntes instanceof Date ? valorAntes.toISOString() : valorAntes;
    const b = valorDepois instanceof Date ? valorDepois.toISOString() : valorDepois;
    if (a !== b) diff[campo] = { de: valorAntes, para: valorDepois };
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

// =====================================================================
// VALIDACOES DE NEGOCIO DA AGENDA
// =====================================================================
// Verifica 2 regras antes de criar/editar um agendamento:
//   1. Conflito de horario — sobreposicao de intervalos [data, data+duracao]
//      entre o novo e os existentes do mesmo tenant (ignora CANCELED).
//   2. Cliente duplicado no mesmo dia — mesmo telefone (so digitos) ja agendado
//      no dia (ignora CANCELED).
//
// Retorna { erro: string, conflito: agendamento } ou null se OK.
// Aceita `excluirId` pra edicao (nao bate contra o proprio).
async function validarConflitosAgenda({ clienteId, dataNova, duracaoNova, telefone, excluirId = null }) {
  // Normaliza telefone — só digitos
  const telefoneNorm = (telefone || '').replace(/\D/g, '');

  // Janela do dia (00:00 — 23:59:59) baseado na data do novo agendamento
  const inicioDia = new Date(dataNova);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(dataNova);
  fimDia.setHours(23, 59, 59, 999);

  // Pega todos os agendamentos do dia, exceto CANCELED.
  const existentes = await prisma.agendamento.findMany({
    where: {
      clienteId,
      data: { gte: inicioDia, lte: fimDia },
      status: { not: 'CANCELED' },
      ...(excluirId ? { NOT: { id: excluirId } } : {}),
    },
    select: {
      id: true, nomeCliente: true, telefoneCliente: true,
      data: true, duracao: true, servico: true, status: true,
    },
  });

  const fimNovo = new Date(dataNova.getTime() + (duracaoNova || 30) * 60000);

  // 1. Conflito de horario
  for (const e of existentes) {
    const inicio = new Date(e.data);
    const fim = new Date(inicio.getTime() + (e.duracao || 30) * 60000);
    if (dataNova < fim && fimNovo > inicio) {
      const hh = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return {
        erro: `Conflito de horário: já existe agendamento de ${e.nomeCliente || 'cliente'} às ${hh} (${e.duracao || 30}min). Escolha outro horário.`,
        conflito: e,
      };
    }
  }

  // 2. Cliente duplicado no dia (mesmo telefone)
  if (telefoneNorm && telefoneNorm.length >= 8) {
    const duplicado = existentes.find((e) => {
      const tel = (e.telefoneCliente || '').replace(/\D/g, '');
      return tel === telefoneNorm;
    });
    if (duplicado) {
      const hh = new Date(duplicado.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return {
        erro: `Este cliente já tem agendamento neste dia às ${hh}. Edite o existente em vez de criar outro.`,
        conflito: duplicado,
      };
    }
  }

  return null;
}

roteador.get('/', requerPermissao('AGENDA', 'visualizar'), async (req, res) => {
  try {
    const { month, year, date, inicio, fim } = req.query;
    const where = { ...tenantFiltro(req) };

    // PREFERIDO: front manda inicio/fim em ISO ja calculados no fuso do
    // usuario. Backend so passa adiante — zero risco de TZ shift.
    if (inicio && fim) {
      where.data = { gte: new Date(inicio), lte: new Date(fim) };
    } else if (date) {
      // Compat com clientes antigos. Cuidado: pode shiftar de dia se o
      // servidor nao estiver no mesmo TZ do cliente.
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

    const dataNova = new Date(data);
    const duracaoNova = parseInt(duracao) || 30;

    // Validacao: conflito de horario + cliente duplicado no dia
    const conflito = await validarConflitosAgenda({
      clienteId,
      dataNova,
      duracaoNova,
      telefone: telefoneCliente,
    });
    if (conflito) {
      return res.status(422).json({ erro: conflito.erro, conflito: conflito.conflito });
    }

    const novoAgendamento = await prisma.agendamento.create({
      data: {
        clienteId,
        leadId: leadId || null,
        nomeCliente,
        telefoneCliente,
        data: dataNova,
        duracao: duracaoNova,
        servico,
        preco: parseFloat(preco) || 0,
        observacoes,
        origem: origem || 'MANUAL',
        status: 'PENDING'
      }
    });

    // Log: criacao do agendamento (snapshot inicial nas alteracoes pra contexto)
    await logHistorico({
      agendamentoId: novoAgendamento.id,
      acao: 'CRIADO',
      alteracoes: {
        snapshot: {
          nomeCliente, servico, data: dataNova.toISOString(),
          duracao: duracaoNova, preco: parseFloat(preco) || 0,
        },
      },
      req,
      origem: origem || 'MANUAL',
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
    if (ehImutavel(existente)) return bloqueioImutavel(res);

    if (dados.data) dados.data = new Date(dados.data);
    if (dados.preco) dados.preco = parseFloat(dados.preco);
    if (dados.duracao) dados.duracao = parseInt(dados.duracao);

    // Validacao de conflito so faz sentido se mudou data, duracao ou telefone.
    // Pega o agendamento completo pra pegar os campos que nao vieram no body.
    if (dados.data || dados.duracao || dados.telefoneCliente !== undefined) {
      const atual = await prisma.agendamento.findUnique({
        where: { id },
        select: { data: true, duracao: true, telefoneCliente: true, clienteId: true },
      });
      const conflito = await validarConflitosAgenda({
        clienteId: atual.clienteId,
        dataNova: dados.data || atual.data,
        duracaoNova: dados.duracao || atual.duracao,
        telefone: dados.telefoneCliente !== undefined ? dados.telefoneCliente : atual.telefoneCliente,
        excluirId: id, // nao bate contra ele mesmo
      });
      if (conflito) {
        return res.status(422).json({ erro: conflito.erro, conflito: conflito.conflito });
      }
    }

    // Pega o estado antes pra calcular diff no log
    const antes = await prisma.agendamento.findUnique({
      where: { id },
      select: {
        nomeCliente: true, telefoneCliente: true, data: true,
        duracao: true, servico: true, preco: true, observacoes: true, status: true,
      },
    });

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

    // Diff entre estado antes e dados recebidos. Se nada mudou, nao loga
    // (evita lixo no historico de salvar sem alterar).
    const alteracoes = calcularAlteracoes(antes, dados, [
      'nomeCliente', 'telefoneCliente', 'data', 'duracao',
      'servico', 'preco', 'observacoes', 'status',
    ]);
    if (alteracoes) {
      // Se a unica mudanca foi status, marcamos como STATUS_MUDADO pra UX
      const ehSoStatus = Object.keys(alteracoes).length === 1 && alteracoes.status;
      await logHistorico({
        agendamentoId: id,
        acao: ehSoStatus ? 'STATUS_MUDADO' : 'EDITADO',
        alteracoes,
        req,
      });
    }

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
    if (ehImutavel(existente)) return bloqueioImutavel(res);

    // Snapshot completo pra preservar no log apos delete. SET NULL no FK
    // mantem a linha do historico viva; o snapshot identifica o que foi.
    const snapshot = await prisma.agendamento.findUnique({
      where: { id },
      select: {
        nomeCliente: true, telefoneCliente: true, data: true, duracao: true,
        servico: true, preco: true, status: true, observacoes: true,
      },
    });

    // Loga ANTES do delete pra inserir com agendamentoId ainda valido;
    // o SetNull rebaixa depois sem perder a linha.
    await logHistorico({
      agendamentoId: id,
      acao: 'EXCLUIDO',
      alteracoes: { snapshot: { ...snapshot, data: snapshot?.data?.toISOString() } },
      req,
    });

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
    // Patch de status: tambem barra se o item ja estiver imutavel. Detalhe:
    // a 1a transicao PENDING -> X em item passado e permitida (ehImutavel
    // checa o estado ATUAL antes da mudanca, e PENDING nao trava).
    if (ehImutavel(existente)) return bloqueioImutavel(res);

    const atualizado = await prisma.agendamento.update({
      where: { id },
      data: { status }
    });

    // Log so se realmente mudou
    if (existente.status !== status) {
      await logHistorico({
        agendamentoId: id,
        acao: 'STATUS_MUDADO',
        alteracoes: { status: { de: existente.status, para: status } },
        req,
      });
    }

    res.json(atualizado);
  } catch (erro) {
    console.error('[agenda/status]', erro);
    res.status(500).json({ erro: 'Erro ao mudar status' });
  }
});

// =====================================================================
// HISTORICO DE UM AGENDAMENTO
// =====================================================================
// Retorna o log completo de mudancas (mais recente primeiro).
// Permissao: AGENDA/visualizar (mesma do GET).
roteador.get('/:id/historico', requerPermissao('AGENDA', 'visualizar'), async (req, res) => {
  try {
    const { id } = req.params;
    const existente = await agendamentoDoTenant(id, req);
    if (!existente) return res.status(404).json({ erro: 'Agendamento nao encontrado.' });

    const historico = await prisma.historicoAgendamento.findMany({
      where: { agendamentoId: id },
      orderBy: { criadoEm: 'desc' },
    });

    res.json(historico);
  } catch (erro) {
    console.error('[agenda/historico]', erro);
    res.status(500).json({ erro: 'Erro ao carregar historico' });
  }
});

module.exports = roteador;
