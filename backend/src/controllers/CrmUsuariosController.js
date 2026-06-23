const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const {
  modulosPorSegmento,
  segmentoPermiteEspecialista,
} = require('../constants/gatingSegmento');

// Perfis que um colaborador de tenant pode ter (o Prisma só conhece estes).
// "Especialista" e "Recepção" são TIPOS de UI que persistem como VENDEDOR:
//   - Especialista = VENDEDOR + registro Especialista (jornada/serviços, AGENDA-próprias).
//   - Recepção     = VENDEDOR + preset de permissões (indistinguível de VENDEDOR ao reabrir).
const PERFIS_COLABORADOR_VALIDOS = ['ADMINISTRADOR', 'VENDEDOR'];
const ACOES = ['visualizar', 'criar', 'editar', 'excluir'];

// Senha inicial de qualquer usuário criado pela tela (telas §13): fixa e simples;
// deveTrocarSenha força a troca no primeiro acesso.
const SENHA_PADRAO = '123456';

// Acoes especificas de modulos que fogem do CRUD padrao (sync com o frontend).
// Vazio por enquanto — a Inbox/MENSAGENS (unico caso) saiu no pivo ERP-first.
const ACOES_POR_MODULO = {};
const acoesDoModulo = (modulo) => ACOES_POR_MODULO[modulo] || ACOES;

// Modulos com dimensao de escopo (ve 'PROPRIAS' x 'TODAS').
const MODULOS_COM_ESCOPO = new Set(['AGENDA']);
const ESCOPOS_VALIDOS = ['PROPRIAS', 'TODAS'];

/**
 * Catalogo de modulos disponiveis para concessao no CRM.
 * Mantem em sync com o frontend (CrmUsersPage / constants/permissoes).
 */
const MODULOS_CRM = [
  'CRM',
  'AGENDA',
  'CATALOGO',
  'ESTOQUE',
  'FINANCEIRO',
  'VENDAS',
  'RELATORIOS',
  'ALERTAS',
];

function gerarPermissoesCompletas() {
  const todas = {};
  for (const modulo of MODULOS_CRM) {
    const p = {};
    for (const acao of acoesDoModulo(modulo)) p[acao] = true;
    if (MODULOS_COM_ESCOPO.has(modulo)) p.escopo = 'TODAS';
    todas[modulo] = p;
  }
  return todas;
}

// Sanitiza o objeto de permissoes, mantendo só módulos válidos E permitidos
// pelo SEGMENTO do tenant (loja não concede AGENDA; clínica não concede ESTOQUE).
function sanitizarPermissoes(input, segmento) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const permitidosNoSegmento = new Set(modulosPorSegmento(segmento));
  const limpo = {};
  for (const [modulo, dados] of Object.entries(input)) {
    if (!MODULOS_CRM.includes(modulo)) continue;
    if (!permitidosNoSegmento.has(modulo)) continue;
    if (!dados || typeof dados !== 'object') continue;

    const limpoModulo = {};
    for (const acao of acoesDoModulo(modulo)) {
      limpoModulo[acao] = dados[acao] === true;
    }
    if (MODULOS_COM_ESCOPO.has(modulo)) {
      limpoModulo.escopo = ESCOPOS_VALIDOS.includes(dados.escopo) ? dados.escopo : 'PROPRIAS';
    }
    limpo[modulo] = limpoModulo;
  }
  return limpo;
}

// Garante a AGENDA-próprias do especialista: ele sempre enxerga ao menos a
// própria agenda, independente do que veio na matriz (erp-arquitetura §2.5).
function garantirAgendaPropria(permissoes) {
  const atual = permissoes.AGENDA || {};
  permissoes.AGENDA = {
    visualizar: true,
    criar: atual.criar === true,
    editar: atual.editar === true,
    excluir: atual.excluir === true,
    escopo: atual.escopo === 'TODAS' ? 'TODAS' : 'PROPRIAS',
  };
  return permissoes;
}

// Valida que os produtos (serviços) pertencem ao tenant. Retorna os ids válidos.
// Migrado de especialistas.routes.js (a tela de especialistas morreu — telas §13).
async function validarServicos(clienteId, servicosIds) {
  if (!Array.isArray(servicosIds) || servicosIds.length === 0) return [];
  const ids = servicosIds.filter((x) => typeof x === 'string');
  if (ids.length === 0) return [];
  const produtos = await prisma.produto.findMany({
    where: { id: { in: ids }, clienteId },
    select: { id: true },
  });
  return produtos.map((p) => p.id);
}

async function carregarSegmento(clienteId) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { segmento: true },
  });
  return cliente?.segmento || null;
}

// Tipo de UI derivado do registro persistido (para a tela reabrir o usuário no
// tipo certo). Recepção é indistinguível de Vendedor ao reabrir (não há campo
// no schema) — colapsa em VENDEDOR; um tipo Recepção persistido depende de
// schema novo (Frente 1) e fica fora deste escopo.
function tipoDerivado(usuario) {
  if (usuario.especialista) return 'ESPECIALISTA';
  if (usuario.perfil === 'ADMINISTRADOR') return 'ADMINISTRADOR';
  return 'VENDEDOR';
}

// Achata o especialista para o formato que o front consome (servicosIds).
function especialistaResumo(esp) {
  if (!esp) return null;
  return {
    id: esp.id,
    ativo: esp.ativo,
    jornada: esp.jornada || null,
    servicosIds: (esp.servicos || []).map((s) => s.produtoId),
  };
}

class CrmUsuariosController {
  /**
   * Lista colaboradores do tenant do usuario logado (todos os tipos, incluindo
   * especialistas). NUNCA inclui o proprio CLIENT (dono).
   */
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const usuarios = await prisma.usuario.findMany({
        where: {
          clienteId,
          perfil: { in: PERFIS_COLABORADOR_VALIDOS },
        },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          permissoes: true,
          deveTrocarSenha: true,
          criadoEm: true,
          especialista: {
            select: {
              id: true,
              ativo: true,
              jornada: true,
              servicos: { select: { produtoId: true } },
            },
          },
        },
        orderBy: { criadoEm: 'desc' },
      });

      res.json(usuarios.map((u) => ({
        ...u,
        tipo: tipoDerivado(u),
        especialista: especialistaResumo(u.especialista),
      })));
    } catch (error) {
      console.error('[CrmUsuariosController/listar]', error);
      res.status(500).json({ error: 'Erro ao listar usuarios do CRM' });
    }
  }

  /**
   * Cria usuário do tenant (Administrador, Vendedor/Recepção ou Especialista).
   * Apenas o CLIENT (dono) ou um ADMINISTRADOR podem criar.
   * Quando vem `especialista` no corpo, cria Usuario + Especialista em transação.
   */
  async criar(req, res) {
    try {
      const { clienteId, perfil: perfilSolicitante } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      if (perfilSolicitante !== 'CLIENT' && perfilSolicitante !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Voce nao tem permissao para cadastrar usuarios.' });
      }

      const { nome, email, senha, perfil, permissoes, especialista } = req.body;
      const ehEspecialista = !!especialista && typeof especialista === 'object';

      if (!nome || !email) {
        return res.status(400).json({ error: 'Campos obrigatorios: nome e email.' });
      }
      const emailNorm = String(email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
        return res.status(400).json({ error: 'E-mail invalido.' });
      }

      // Senha inicial fixa (123456) quando não informada; aceita override (>=6).
      if (senha !== undefined && (typeof senha !== 'string' || senha.length < 6)) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
      }
      const senhaParaUsar = senha || SENHA_PADRAO;

      // Especialista persiste como VENDEDOR; demais respeitam o perfil enviado.
      const perfilFinal = ehEspecialista ? 'VENDEDOR' : perfil;
      if (!PERFIS_COLABORADOR_VALIDOS.includes(perfilFinal)) {
        return res.status(400).json({
          error: `Perfil invalido. Use: ${PERFIS_COLABORADOR_VALIDOS.join(' ou ')}.`,
        });
      }

      // ADMINISTRADOR nao pode criar outro ADMINISTRADOR (privilege creep).
      if (perfilSolicitante === 'ADMINISTRADOR' && perfilFinal === 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Apenas o dono da conta pode criar outro Administrador.' });
      }

      const segmento = await carregarSegmento(clienteId);
      if (ehEspecialista && !segmentoPermiteEspecialista(segmento)) {
        return res.status(400).json({ error: 'Especialista nao esta disponivel para este segmento de negocio.' });
      }

      const usuarioExistente = await prisma.usuario.findUnique({ where: { email: emailNorm }, select: { id: true } });
      if (usuarioExistente) {
        return res.status(400).json({ error: 'Este e-mail ja esta cadastrado.' });
      }

      // ADMINISTRADOR -> permissoes completas. Demais -> sanitizadas por segmento.
      let permissoesFinais = perfilFinal === 'ADMINISTRADOR'
        ? gerarPermissoesCompletas()
        : sanitizarPermissoes(permissoes, segmento);
      if (ehEspecialista) permissoesFinais = garantirAgendaPropria(permissoesFinais);

      const senhaHasheada = await bcrypt.hash(senhaParaUsar, 12);

      // Valida serviços ANTES da transação (leitura).
      const servicosValidos = ehEspecialista
        ? await validarServicos(clienteId, especialista.servicosIds)
        : [];

      const dadosUsuario = {
        nome: nome.trim(),
        email: emailNorm,
        senha: senhaHasheada,
        clienteId,
        perfil: perfilFinal,
        permissoes: permissoesFinais,
        deveTrocarSenha: true,
      };

      let criado;
      if (ehEspecialista) {
        criado = await prisma.$transaction(async (tx) => {
          const usuario = await tx.usuario.create({ data: dadosUsuario, select: { id: true } });
          await tx.especialista.create({
            data: {
              clienteId,
              nome: nome.trim(),
              ativo: especialista.ativo === false ? false : true,
              usuarioId: usuario.id,
              jornada: especialista.jornada && typeof especialista.jornada === 'object' ? especialista.jornada : null,
              servicos: { create: servicosValidos.map((produtoId) => ({ produtoId })) },
            },
          });
          return tx.usuario.findUnique({
            where: { id: usuario.id },
            select: {
              id: true, nome: true, email: true, perfil: true, permissoes: true,
              especialista: { select: { id: true, ativo: true, jornada: true, servicos: { select: { produtoId: true } } } },
            },
          });
        });
      } else {
        criado = await prisma.usuario.create({
          data: dadosUsuario,
          select: { id: true, nome: true, email: true, perfil: true, permissoes: true },
        });
      }

      res.status(201).json({ ...criado, tipo: tipoDerivado(criado), especialista: especialistaResumo(criado.especialista) });
    } catch (error) {
      console.error('[CrmUsuariosController/criar]', error);
      if (error.code === 'P2002') return res.status(400).json({ error: 'Este e-mail ja esta cadastrado.' });
      res.status(500).json({ error: 'Erro ao criar usuario do CRM' });
    }
  }

  /**
   * Atualiza usuário do tenant (dados, perfil, permissões e — se especialista —
   * jornada/serviços). Regras de hierarquia preservadas:
   * - CLIENT pode tudo (menos a si mesmo via campos sensíveis? não — dono é intocável só como ALVO).
   * - ADMINISTRADOR pode VENDEDOR, nunca outro ADMINISTRADOR nem o CLIENT.
   * - O CLIENT (dono) NUNCA é alterado por aqui.
   */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { clienteId, perfil: perfilSolicitante, id: idSolicitante } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, email, senha, perfil, permissoes, especialista } = req.body;

      const alvo = await prisma.usuario.findFirst({
        where: { id, clienteId },
        select: { id: true, perfil: true, especialista: { select: { id: true } } },
      });
      if (!alvo) return res.status(404).json({ error: 'Usuario nao encontrado.' });

      if (alvo.perfil === 'CLIENT') {
        return res.status(403).json({ error: 'O usuario dono da conta nao pode ser alterado por aqui.' });
      }
      if (perfilSolicitante === 'ADMINISTRADOR' && alvo.perfil === 'ADMINISTRADOR' && alvo.id !== idSolicitante) {
        return res.status(403).json({ error: 'Voce nao pode alterar outro Administrador.' });
      }
      if (perfilSolicitante === 'VENDEDOR' && alvo.id !== idSolicitante) {
        return res.status(403).json({ error: 'Voce so pode alterar seu proprio cadastro.' });
      }

      const ehEspecialista = !!alvo.especialista;
      const segmento = await carregarSegmento(clienteId);

      const dadosUsuario = {};
      if (nome !== undefined) {
        if (typeof nome !== 'string' || !nome.trim()) return res.status(400).json({ error: 'Nome invalido.' });
        dadosUsuario.nome = nome.trim();
      }
      if (email !== undefined) dadosUsuario.email = String(email).trim().toLowerCase();

      if (senha) {
        if (typeof senha !== 'string' || senha.length < 6) {
          return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
        }
        dadosUsuario.senha = await bcrypt.hash(senha, 12);
        if (alvo.id === idSolicitante) dadosUsuario.deveTrocarSenha = false;
      }

      // Perfil/permissões: só CLIENT ou ADMINISTRADOR (sobre alvo não-admin).
      // Especialista é sempre VENDEDOR — o perfil não muda por aqui.
      const podeMudarPerfilOuPermissoes =
        perfilSolicitante === 'CLIENT' ||
        (perfilSolicitante === 'ADMINISTRADOR' && alvo.perfil !== 'ADMINISTRADOR');

      if (podeMudarPerfilOuPermissoes && !ehEspecialista) {
        if (perfil !== undefined) {
          if (!PERFIS_COLABORADOR_VALIDOS.includes(perfil)) {
            return res.status(400).json({ error: `Perfil invalido. Use: ${PERFIS_COLABORADOR_VALIDOS.join(' ou ')}.` });
          }
          if (perfilSolicitante === 'ADMINISTRADOR' && perfil === 'ADMINISTRADOR') {
            return res.status(403).json({ error: 'Apenas o dono da conta pode promover a Administrador.' });
          }
          dadosUsuario.perfil = perfil;
          if (perfil === 'ADMINISTRADOR') {
            dadosUsuario.permissoes = gerarPermissoesCompletas();
          } else if (permissoes !== undefined) {
            dadosUsuario.permissoes = sanitizarPermissoes(permissoes, segmento);
          }
        } else if (permissoes !== undefined) {
          dadosUsuario.permissoes = alvo.perfil === 'ADMINISTRADOR'
            ? gerarPermissoesCompletas()
            : sanitizarPermissoes(permissoes, segmento);
        }
      } else if (podeMudarPerfilOuPermissoes && ehEspecialista && permissoes !== undefined) {
        // Especialista: aplica a matriz, mas mantém a AGENDA-próprias garantida.
        dadosUsuario.permissoes = garantirAgendaPropria(sanitizarPermissoes(permissoes, segmento));
      }

      // Campos do Especialista (jornada / serviços / ativo), em transação com o usuário.
      const atualizarEspecialista = ehEspecialista && especialista && typeof especialista === 'object';
      let servicosValidos = null;
      if (atualizarEspecialista && especialista.servicosIds !== undefined) {
        servicosValidos = await validarServicos(clienteId, especialista.servicosIds);
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(dadosUsuario).length > 0) {
          await tx.usuario.update({ where: { id }, data: dadosUsuario });
        }
        if (atualizarEspecialista) {
          const dataEsp = {};
          if (dadosUsuario.nome) dataEsp.nome = dadosUsuario.nome; // mantém nome em sync
          if (especialista.ativo !== undefined) dataEsp.ativo = especialista.ativo === true;
          if (especialista.jornada !== undefined) {
            dataEsp.jornada = especialista.jornada && typeof especialista.jornada === 'object' ? especialista.jornada : null;
          }
          if (Object.keys(dataEsp).length > 0) {
            await tx.especialista.update({ where: { id: alvo.especialista.id }, data: dataEsp });
          }
          if (servicosValidos !== null) {
            await tx.especialistaServico.deleteMany({ where: { especialistaId: alvo.especialista.id } });
            if (servicosValidos.length > 0) {
              await tx.especialistaServico.createMany({
                data: servicosValidos.map((produtoId) => ({ especialistaId: alvo.especialista.id, produtoId })),
              });
            }
          }
        }
      });

      const atualizado = await prisma.usuario.findUnique({
        where: { id },
        select: {
          id: true, nome: true, email: true, perfil: true, permissoes: true,
          especialista: { select: { id: true, ativo: true, jornada: true, servicos: { select: { produtoId: true } } } },
        },
      });
      res.json({ ...atualizado, tipo: tipoDerivado(atualizado), especialista: especialistaResumo(atualizado.especialista) });
    } catch (error) {
      console.error('[CrmUsuariosController/atualizar]', error);
      if (error.code === 'P2002') return res.status(400).json({ error: 'Este e-mail ja esta em uso.' });
      res.status(500).json({ error: 'Erro ao atualizar usuario do CRM' });
    }
  }

  /**
   * Excluir usuário do tenant. Quando é especialista, remove Usuario +
   * Especialista na mesma transação (agendamentos sobrevivem por FK SetNull).
   * - CLIENT (dono) NUNCA pode ser excluído. ADMINISTRADOR não exclui outro
   *   ADMINISTRADOR. VENDEDOR não exclui ninguém.
   */
  async excluir(req, res) {
    try {
      const { id } = req.params;
      const { clienteId, perfil: perfilSolicitante, id: idSolicitante } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      if (perfilSolicitante === 'VENDEDOR') {
        return res.status(403).json({ error: 'Voce nao tem permissao para excluir usuarios.' });
      }

      const alvo = await prisma.usuario.findFirst({
        where: { id, clienteId },
        select: { id: true, perfil: true, especialista: { select: { id: true } } },
      });
      if (!alvo) return res.status(404).json({ error: 'Usuario nao encontrado.' });

      if (alvo.perfil === 'CLIENT') {
        return res.status(403).json({ error: 'O usuario dono da conta nao pode ser excluido.' });
      }
      if (perfilSolicitante === 'ADMINISTRADOR' && alvo.perfil === 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Voce nao pode excluir outro Administrador.' });
      }
      if (id === idSolicitante) {
        return res.status(400).json({ error: 'Voce nao pode excluir o seu proprio usuario.' });
      }

      if (alvo.especialista) {
        await prisma.$transaction(async (tx) => {
          await tx.especialista.delete({ where: { id: alvo.especialista.id } });
          await tx.usuario.delete({ where: { id } });
        });
      } else {
        await prisma.usuario.delete({ where: { id } });
      }

      res.json({ message: 'Usuario removido com sucesso.' });
    } catch (error) {
      console.error('[CrmUsuariosController/excluir]', error);
      res.status(500).json({ error: 'Erro ao excluir usuario do CRM' });
    }
  }
}

module.exports = new CrmUsuariosController();
module.exports.MODULOS_CRM = MODULOS_CRM;
module.exports.ACOES = ACOES;
