/**
 * Middlewares de autorizacao do Sellergy Cloud.
 *
 * Hierarquia:
 *   ADMIN          -> dono do sistema, acesso global, ignora modulosLiberados.
 *   CLIENT         -> dono do tenant, acesso total ao seu proprio tenant
 *                     (sujeito aos modulosLiberados pelo admin).
 *   ADMINISTRADOR  -> colaborador do tenant com permissoes completas (preset).
 *   VENDEDOR       -> colaborador do tenant com permissoes customizadas.
 *
 * O middlewareAutenticacao deve ser aplicado ANTES destes (req.usuario populado).
 */

const prisma = require('../prisma');

const PERFIS_TENANT = ['CLIENT', 'ADMINISTRADOR', 'VENDEDOR'];

const ehAdmin = (usuario) => usuario?.perfil === 'ADMIN';
const ehDonoTenant = (usuario) => usuario?.perfil === 'CLIENT';
const ehColaborador = (usuario) => usuario?.perfil === 'ADMINISTRADOR' || usuario?.perfil === 'VENDEDOR';
const ehDoTenant = (usuario) => PERFIS_TENANT.includes(usuario?.perfil);

/**
 * Bloqueia tudo que nao for ADMIN do sistema.
 */
function requerAdmin(req, res, next) {
  if (!ehAdmin(req.usuario)) {
    return res.status(403).json({ erro: 'Acesso restrito ao administrador do sistema.' });
  }
  return next();
}

/**
 * Permite ADMIN do sistema OU usuario com clienteId valido.
 */
function requerTenant(req, res, next) {
  if (ehAdmin(req.usuario)) return next();
  if (ehDoTenant(req.usuario) && req.usuario.clienteId) return next();
  return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });
}

/**
 * Verifica se o tenant tem o modulo liberado pelo admin.
 * ADMIN passa direto. CLIENT/ADMINISTRADOR/VENDEDOR sao bloqueados se o modulo nao esta liberado.
 *
 * @param {string} modulo - identificador do modulo (ex: 'BOTS', 'CRM', 'FINANCEIRO').
 */
function requerModuloLiberado(modulo) {
  return async function (req, res, next) {
    try {
      if (ehAdmin(req.usuario)) return next();

      if (!req.usuario?.clienteId) {
        return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });
      }

      const cliente = await prisma.cliente.findUnique({
        where: { id: req.usuario.clienteId },
        select: { modulosLiberados: true, status: true }
      });

      if (!cliente) {
        return res.status(403).json({ erro: 'Tenant nao encontrado.' });
      }

      if (cliente.status !== 'ACTIVE') {
        return res.status(403).json({ erro: 'Conta inativa ou suspensa.' });
      }

      const modulos = cliente.modulosLiberados || {};
      if (modulos[modulo] !== true) {
        return res.status(403).json({ erro: `Modulo "${modulo}" nao esta liberado para este cliente.` });
      }

      return next();
    } catch (erro) {
      console.error('[requerModuloLiberado]', erro);
      return res.status(500).json({ erro: 'Erro ao validar modulo liberado.' });
    }
  };
}

/**
 * Verifica se o usuario tem a permissao especifica dentro de um modulo.
 * - ADMIN passa direto.
 * - CLIENT (dono do tenant) passa direto se o modulo esta liberado.
 * - ADMINISTRADOR (colaborador) passa direto (preset com tudo).
 * - VENDEDOR so passa se permissoes[modulo][acao] === true.
 *
 * Deve ser usado em conjunto com requerModuloLiberado(modulo).
 *
 * @param {string} modulo - ex: 'CRM'
 * @param {string} acao   - 'visualizar' | 'criar' | 'editar' | 'excluir'
 */
function requerPermissao(modulo, acao) {
  const acoesValidas = ['visualizar', 'criar', 'editar', 'excluir'];
  if (!acoesValidas.includes(acao)) {
    throw new Error(`Acao invalida: ${acao}. Use: ${acoesValidas.join(', ')}`);
  }

  return async function (req, res, next) {
    try {
      if (ehAdmin(req.usuario)) return next();
      if (ehDonoTenant(req.usuario)) return next();
      if (req.usuario?.perfil === 'ADMINISTRADOR') return next();

      // VENDEDOR (e qualquer outro perfil de tenant): verifica permissoes JSON.
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario.id },
        select: { permissoes: true }
      });

      const permissoes = usuario?.permissoes || {};
      const permissoesModulo = permissoes[modulo] || {};

      if (permissoesModulo[acao] !== true) {
        return res.status(403).json({
          erro: `Permissao negada: voce nao pode "${acao}" no modulo "${modulo}".`
        });
      }

      return next();
    } catch (erro) {
      console.error('[requerPermissao]', erro);
      return res.status(500).json({ erro: 'Erro ao validar permissao.' });
    }
  };
}

module.exports = {
  ehAdmin,
  ehDonoTenant,
  ehColaborador,
  ehDoTenant,
  requerAdmin,
  requerTenant,
  requerModuloLiberado,
  requerPermissao,
  PERFIS_TENANT,
};
