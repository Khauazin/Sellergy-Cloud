// CRUD de Especialistas (recurso agendavel — perfil Servico).
// Especialista = quem executa servicos e pode ser agendado. Vinculo opcional
// 1:1 com um Usuario (login). Os servicos que executa sao M:N com Produto
// (EspecialistaServico). A jornada e um JSON (ver schema).
//
// Gateado por AGENDA (especialista so faz sentido em tenant de servico com agenda).
// Multi-tenant rigido: tudo filtra por clienteId.

const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  ehAdmin,
  requerModuloLiberado,
  requerPermissao,
  requerPapelPrivilegiado,
} = require('../middlewares/permissoes.middleware');

// Senha inicial do login do especialista — fixa e simples; deveTrocarSenha
// forca a troca no primeiro acesso.
const SENHA_PADRAO = '123456';

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('AGENDA'));

function filtroTenant(req) {
  return ehAdmin(req.usuario) ? {} : { clienteId: req.usuario.clienteId };
}

// Valida que os produtos (servicos) pertencem ao tenant. Retorna os ids validos.
async function validarServicos(clienteId, servicosIds) {
  if (!Array.isArray(servicosIds) || servicosIds.length === 0) return [];
  const ids = servicosIds.filter((x) => typeof x === 'string');
  const produtos = await prisma.produto.findMany({
    where: { id: { in: ids }, clienteId },
    select: { id: true },
  });
  return produtos.map((p) => p.id);
}

// Valida o vinculo opcional com Usuario: precisa ser do tenant e nao estar
// vinculado a outro especialista. Retorna { erro } ou { usuarioId }.
async function validarUsuarioVinculo({ usuarioId, clienteId, especialistaIdAtual = null }) {
  if (!usuarioId) return { usuarioId: null };
  const u = await prisma.usuario.findFirst({
    where: { id: usuarioId, clienteId },
    select: { id: true, especialista: { select: { id: true } } },
  });
  if (!u) return { erro: 'Usuario nao pertence ao tenant.' };
  if (u.especialista && u.especialista.id !== especialistaIdAtual) {
    return { erro: 'Esse usuario ja esta vinculado a outro especialista.' };
  }
  return { usuarioId: u.id };
}

function saida(esp) {
  return {
    ...esp,
    servicosIds: (esp.servicos || []).map((s) => s.produtoId),
    servicos: undefined,
  };
}

roteador.get('/', requerPermissao('AGENDA', 'visualizar'), async (req, res) => {
  try {
    const especialistas = await prisma.especialista.findMany({
      where: filtroTenant(req),
      include: {
        servicos: { select: { produtoId: true } },
        usuario: { select: { id: true, nome: true, email: true } },
      },
      orderBy: { nome: 'asc' },
    });
    res.json(especialistas.map(saida));
  } catch (erro) {
    console.error('[especialistas/list]', erro);
    res.status(500).json({ erro: 'Erro ao listar especialistas.' });
  }
});

roteador.post('/', requerPapelPrivilegiado, async (req, res) => {
  try {
    const clienteId = ehAdmin(req.usuario) ? req.body?.clienteId : req.usuario.clienteId;
    if (!clienteId) return res.status(400).json({ erro: 'clienteId obrigatorio.' });

    const { nome, ativo, usuarioId, jornada, servicosIds, acesso } = req.body || {};
    if (typeof nome !== 'string' || !nome.trim()) {
      return res.status(400).json({ erro: 'nome obrigatorio.' });
    }

    const servicosValidos = await validarServicos(clienteId, servicosIds);

    // Validacoes de leitura ANTES da transacao.
    // (1) Criar login novo (acesso) OU (2) linkar usuario existente.
    let emailNovo = null;
    let vincExistente = null;
    if (acesso && typeof acesso === 'object' && acesso.email) {
      emailNovo = String(acesso.email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNovo)) {
        return res.status(400).json({ erro: 'E-mail invalido.' });
      }
      const jaExiste = await prisma.usuario.findUnique({ where: { email: emailNovo }, select: { id: true } });
      if (jaExiste) return res.status(400).json({ erro: 'Este e-mail ja esta cadastrado.' });
    } else if (usuarioId) {
      vincExistente = await validarUsuarioVinculo({ usuarioId, clienteId });
      if (vincExistente.erro) return res.status(400).json({ erro: vincExistente.erro });
    }

    const especialista = await prisma.$transaction(async (tx) => {
      let usuarioIdFinal = vincExistente ? vincExistente.usuarioId : null;
      if (emailNovo) {
        const senhaHasheada = await bcrypt.hash(SENHA_PADRAO, 12);
        // AGENDA sempre garantida no escopo proprio. O dono libera outros
        // modulos depois, na tela de Equipe.
        const novoUsuario = await tx.usuario.create({
          data: {
            nome: nome.trim(),
            email: emailNovo,
            senha: senhaHasheada,
            perfil: 'VENDEDOR',
            clienteId,
            deveTrocarSenha: true,
            permissoes: {
              AGENDA: { visualizar: true, criar: false, editar: false, excluir: false, escopo: 'PROPRIAS' },
            },
          },
          select: { id: true },
        });
        usuarioIdFinal = novoUsuario.id;
      }
      return tx.especialista.create({
        data: {
          clienteId,
          nome: nome.trim(),
          ativo: ativo === false ? false : true,
          usuarioId: usuarioIdFinal,
          jornada: jornada && typeof jornada === 'object' ? jornada : null,
          servicos: { create: servicosValidos.map((produtoId) => ({ produtoId })) },
        },
        include: { servicos: { select: { produtoId: true } } },
      });
    });
    res.status(201).json(saida(especialista));
  } catch (erro) {
    console.error('[especialistas/create]', erro);
    if (erro.code === 'P2002') return res.status(400).json({ erro: 'E-mail ja cadastrado.' });
    res.status(500).json({ erro: 'Erro ao criar especialista.' });
  }
});

roteador.put('/:id', requerPapelPrivilegiado, async (req, res) => {
  try {
    const existente = await prisma.especialista.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      select: { id: true, clienteId: true },
    });
    if (!existente) return res.status(404).json({ erro: 'Especialista nao encontrado.' });

    const { nome, ativo, usuarioId, jornada, servicosIds } = req.body || {};
    const data = {};
    if (nome !== undefined) {
      if (typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ erro: 'nome invalido.' });
      data.nome = nome.trim();
    }
    if (ativo !== undefined) data.ativo = ativo === true;
    if (jornada !== undefined) data.jornada = jornada && typeof jornada === 'object' ? jornada : null;
    if (usuarioId !== undefined) {
      const vinc = await validarUsuarioVinculo({
        usuarioId, clienteId: existente.clienteId, especialistaIdAtual: existente.id,
      });
      if (vinc.erro) return res.status(400).json({ erro: vinc.erro });
      data.usuarioId = vinc.usuarioId;
    }

    // Se servicosIds veio, substitui o conjunto inteiro (deleteMany + createMany).
    if (servicosIds !== undefined) {
      const validos = await validarServicos(existente.clienteId, servicosIds);
      await prisma.$transaction([
        prisma.especialistaServico.deleteMany({ where: { especialistaId: existente.id } }),
        ...(validos.length
          ? [prisma.especialistaServico.createMany({
              data: validos.map((produtoId) => ({ especialistaId: existente.id, produtoId })),
            })]
          : []),
      ]);
    }

    const atualizado = await prisma.especialista.update({
      where: { id: existente.id },
      data,
      include: { servicos: { select: { produtoId: true } } },
    });
    res.json(saida(atualizado));
  } catch (erro) {
    console.error('[especialistas/update]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar especialista.' });
  }
});

roteador.delete('/:id', requerPapelPrivilegiado, async (req, res) => {
  try {
    const existente = await prisma.especialista.findFirst({
      where: { id: req.params.id, ...filtroTenant(req) },
      select: { id: true },
    });
    if (!existente) return res.status(404).json({ erro: 'Especialista nao encontrado.' });
    // Agendamentos do especialista sobrevivem (FK SetNull); vinculos M:N caem (Cascade).
    await prisma.especialista.delete({ where: { id: existente.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error('[especialistas/delete]', erro);
    res.status(500).json({ erro: 'Erro ao excluir especialista.' });
  }
});

module.exports = roteador;
