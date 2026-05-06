// Politica de acesso ao CONTEUDO das mensagens.
//
// Filosofia (memoria do projeto): "admin nunca ve conteudo de mensagens".
// O ADMIN do sistema (dono da plataforma) pode listar metadata (canal, autor,
// timestamp, status, tipo, conversaId) mas NAO pode chamar o decryptor.
// Tenant members (CLIENT/ADMINISTRADOR/VENDEDOR) descriptografam mensagens
// do PROPRIO tenant.
//
// Use este middleware ANTES de rotas que retornam conteudo decifrado, e
// chame `auditarLeitura(...)` em todo lookup que decifre.

const prisma = require('../prisma');
const { ehAdmin } = require('./permissoes.middleware');

const PERFIS_TENANT = ['CLIENT', 'ADMINISTRADOR', 'VENDEDOR'];

function requerAcessoConteudoMensagem(req, res, next) {
  const usuario = req.usuario;
  if (!usuario) {
    return res.status(401).json({ erro: 'Autenticacao necessaria.' });
  }
  if (ehAdmin(usuario)) {
    return res.status(403).json({
      erro: 'Admin do sistema nao tem acesso ao conteudo de mensagens dos clientes.',
    });
  }
  if (!PERFIS_TENANT.includes(usuario.perfil) || !usuario.clienteId) {
    return res.status(403).json({ erro: 'Apenas usuarios do tenant podem ler mensagens.' });
  }
  return next();
}

// Verifica se o tenant do `clienteId` do recurso bate com o usuario.
function pertenceAoTenantDoUsuario(usuario, clienteIdRecurso) {
  if (!usuario || !clienteIdRecurso) return false;
  if (ehAdmin(usuario)) return false; // admin global nunca le conteudo
  return usuario.clienteId === clienteIdRecurso;
}

async function auditarLeitura({ mensagemId, usuario, ip, userAgent }) {
  try {
    await prisma.auditoriaMensagem.create({
      data: {
        mensagemId,
        usuarioId: usuario?.id || null,
        acao: 'LEITURA',
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });
  } catch (erro) {
    console.error('[auditoria/leitura]', erro);
  }
}

async function auditarCriacao({ mensagemId, usuario, ip, userAgent }) {
  try {
    await prisma.auditoriaMensagem.create({
      data: {
        mensagemId,
        usuarioId: usuario?.id || null,
        acao: 'CRIACAO',
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });
  } catch (erro) {
    console.error('[auditoria/criacao]', erro);
  }
}

module.exports = {
  requerAcessoConteudoMensagem,
  pertenceAoTenantDoUsuario,
  auditarLeitura,
  auditarCriacao,
};
