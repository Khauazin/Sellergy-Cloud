const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

const PERFIS_COLABORADOR_VALIDOS = ['ADMINISTRADOR', 'VENDEDOR'];
const ACOES = ['visualizar', 'criar', 'editar', 'excluir'];

// Acoes especificas de modulos que fogem do CRUD padrao (sync com o frontend).
const ACOES_POR_MODULO = {
  MENSAGENS: ['visualizar', 'responder', 'atribuir'],
};
const acoesDoModulo = (modulo) => ACOES_POR_MODULO[modulo] || ACOES;

// Modulos com dimensao de escopo (ve 'PROPRIAS' x 'TODAS').
const MODULOS_COM_ESCOPO = new Set(['MENSAGENS', 'AGENDA']);
const ESCOPOS_VALIDOS = ['PROPRIAS', 'TODAS'];

/**
 * Catalogo de modulos disponiveis para concessao no CRM.
 * Mantem em sync com o frontend (CrmUsersPage / constants/permissoes).
 */
const MODULOS_CRM = [
  'CRM',
  'MENSAGENS',
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

function sanitizarPermissoes(input) {
  // Aceita { modulo: { acao: bool, escopo?: 'PROPRIAS'|'TODAS' } }, descarta o resto.
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const limpo = {};
  for (const [modulo, dados] of Object.entries(input)) {
    if (!MODULOS_CRM.includes(modulo)) continue;
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

class CrmUsuariosController {
  /**
   * Lista colaboradores do tenant do usuario logado.
   * Importante: NUNCA inclui o proprio CLIENT (dono) na lista de colaboradores.
   */
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const usuarios = await prisma.usuario.findMany({
        where: {
          clienteId,
          perfil: { in: PERFIS_COLABORADOR_VALIDOS }
        },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          permissoes: true,
          deveTrocarSenha: true,
          criadoEm: true,
        },
        orderBy: { criadoEm: 'desc' }
      });

      res.json(usuarios);
    } catch (error) {
      console.error('[CrmUsuariosController/listar]', error);
      res.status(500).json({ error: 'Erro ao listar usuarios do CRM' });
    }
  }

  /**
   * Cria colaborador (ADMINISTRADOR ou VENDEDOR) no tenant.
   * Apenas o CLIENT (dono) ou um ADMINISTRADOR podem criar.
   * VENDEDOR nao pode criar usuarios.
   */
  async criar(req, res) {
    try {
      const { clienteId, perfil: perfilSolicitante } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      if (perfilSolicitante !== 'CLIENT' && perfilSolicitante !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Voce nao tem permissao para cadastrar usuarios.' });
      }

      const { nome, email, senha, perfil, permissoes } = req.body;

      if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Campos obrigatorios: nome, email e senha.' });
      }

      if (typeof senha !== 'string' || senha.length < 6) {
        return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
      }

      if (!PERFIS_COLABORADOR_VALIDOS.includes(perfil)) {
        return res.status(400).json({
          error: `Perfil invalido. Use: ${PERFIS_COLABORADOR_VALIDOS.join(' ou ')}.`
        });
      }

      // ADMINISTRADOR nao pode criar outro ADMINISTRADOR (privilege creep).
      if (perfilSolicitante === 'ADMINISTRADOR' && perfil === 'ADMINISTRADOR') {
        return res.status(403).json({
          error: 'Apenas o dono da conta pode criar outro Administrador.'
        });
      }

      const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
      if (usuarioExistente) {
        return res.status(400).json({ error: 'Este e-mail ja esta cadastrado.' });
      }

      const senhaHasheada = await bcrypt.hash(senha, 12);

      // ADMINISTRADOR -> permissoes preset (todas marcadas).
      // VENDEDOR -> permissoes vindas do body, sanitizadas.
      const permissoesFinais = perfil === 'ADMINISTRADOR'
        ? gerarPermissoesCompletas()
        : sanitizarPermissoes(permissoes);

      const novoUsuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHasheada,
          clienteId,
          perfil,
          permissoes: permissoesFinais,
          deveTrocarSenha: true, // forca colaborador a trocar a senha no primeiro acesso
        },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          permissoes: true,
        }
      });

      res.status(201).json(novoUsuario);
    } catch (error) {
      console.error('[CrmUsuariosController/criar]', error);
      res.status(500).json({ error: 'Erro ao criar usuario do CRM' });
    }
  }

  /**
   * Atualiza colaborador.
   * - CLIENT pode atualizar qualquer colaborador do seu tenant.
   * - ADMINISTRADOR pode atualizar VENDEDOR, mas nunca outro ADMINISTRADOR ou o CLIENT.
   * - Ninguem nunca atualiza usuario CLIENT por aqui (ele eh intocavel via CRM).
   */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { clienteId, perfil: perfilSolicitante, id: idSolicitante } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, email, senha, perfil, permissoes } = req.body;

      // Carrega o alvo e garante que pertence ao mesmo tenant.
      const alvo = await prisma.usuario.findFirst({
        where: { id, clienteId }
      });

      if (!alvo) {
        return res.status(404).json({ error: 'Usuario nao encontrado.' });
      }

      // O dono da conta (CLIENT) NUNCA pode ser alterado via CRM.
      if (alvo.perfil === 'CLIENT') {
        return res.status(403).json({ error: 'O usuario dono da conta nao pode ser alterado por aqui.' });
      }

      // ADMINISTRADOR nao pode alterar outro ADMINISTRADOR.
      if (perfilSolicitante === 'ADMINISTRADOR' && alvo.perfil === 'ADMINISTRADOR' && alvo.id !== idSolicitante) {
        return res.status(403).json({ error: 'Voce nao pode alterar outro Administrador.' });
      }

      // VENDEDOR so pode alterar a si mesmo (nome/senha), e nunca o proprio perfil ou permissoes.
      if (perfilSolicitante === 'VENDEDOR') {
        if (alvo.id !== idSolicitante) {
          return res.status(403).json({ error: 'Voce so pode alterar seu proprio cadastro.' });
        }
      }

      const dadosParaAtualizar = {};
      if (nome !== undefined) dadosParaAtualizar.nome = nome;
      if (email !== undefined) dadosParaAtualizar.email = email;

      if (senha) {
        if (typeof senha !== 'string' || senha.length < 6) {
          return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
        }
        dadosParaAtualizar.senha = await bcrypt.hash(senha, 12);
        // Quando o proprio usuario troca a senha, limpa a flag.
        if (alvo.id === idSolicitante) {
          dadosParaAtualizar.deveTrocarSenha = false;
        }
      }

      // Mudanca de perfil/permissoes apenas para CLIENT ou ADMINISTRADOR (alvo nao-admin).
      const podeMudarPerfilOuPermissoes =
        perfilSolicitante === 'CLIENT' ||
        (perfilSolicitante === 'ADMINISTRADOR' && alvo.perfil !== 'ADMINISTRADOR');

      if (podeMudarPerfilOuPermissoes) {
        if (perfil !== undefined) {
          if (!PERFIS_COLABORADOR_VALIDOS.includes(perfil)) {
            return res.status(400).json({
              error: `Perfil invalido. Use: ${PERFIS_COLABORADOR_VALIDOS.join(' ou ')}.`
            });
          }
          // ADMINISTRADOR nao pode promover ninguem a ADMINISTRADOR.
          if (perfilSolicitante === 'ADMINISTRADOR' && perfil === 'ADMINISTRADOR') {
            return res.status(403).json({ error: 'Apenas o dono da conta pode promover a Administrador.' });
          }
          dadosParaAtualizar.perfil = perfil;

          // Se virou ADMINISTRADOR, recria permissoes completas.
          // Se virou VENDEDOR, usa permissoes do body (ou preserva).
          if (perfil === 'ADMINISTRADOR') {
            dadosParaAtualizar.permissoes = gerarPermissoesCompletas();
          } else if (permissoes !== undefined) {
            dadosParaAtualizar.permissoes = sanitizarPermissoes(permissoes);
          }
        } else if (permissoes !== undefined) {
          // So altera permissoes (sem mudar perfil).
          // Mas se o alvo eh ADMINISTRADOR, ele sempre tem permissoes completas
          // (independente do que vem no body).
          dadosParaAtualizar.permissoes = alvo.perfil === 'ADMINISTRADOR'
            ? gerarPermissoesCompletas()
            : sanitizarPermissoes(permissoes);
        }
      }

      const usuarioAtualizado = await prisma.usuario.update({
        where: { id },
        data: dadosParaAtualizar,
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          permissoes: true,
        }
      });

      res.json(usuarioAtualizado);
    } catch (error) {
      console.error('[CrmUsuariosController/atualizar]', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Este e-mail ja esta em uso.' });
      }
      res.status(500).json({ error: 'Erro ao atualizar usuario do CRM' });
    }
  }

  /**
   * Excluir colaborador.
   * - CLIENT (dono) NUNCA pode ser excluido por aqui.
   * - ADMINISTRADOR nao pode excluir outro ADMINISTRADOR.
   * - VENDEDOR nao pode excluir ninguem.
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
        where: { id, clienteId }
      });

      if (!alvo) {
        return res.status(404).json({ error: 'Usuario nao encontrado.' });
      }

      if (alvo.perfil === 'CLIENT') {
        return res.status(403).json({ error: 'O usuario dono da conta nao pode ser excluido.' });
      }

      if (perfilSolicitante === 'ADMINISTRADOR' && alvo.perfil === 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Voce nao pode excluir outro Administrador.' });
      }

      if (id === idSolicitante) {
        return res.status(400).json({ error: 'Voce nao pode excluir o seu proprio usuario.' });
      }

      await prisma.usuario.delete({ where: { id } });
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
