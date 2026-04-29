const prisma = require('../prisma');
const bcrypt = require('bcryptjs');

class CrmUsuariosController {
  /**
   * Listar usuários vinculados ao cliente do usuário logado
   */
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const usuarios = await prisma.usuario.findMany({
        where: { clienteId },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          // permissoes: true, // Removido temporariamente por erro de sincronização do Prisma
          criadoEm: true,
        }
      });

      res.json(usuarios);
    } catch (error) {
      console.error('[CrmUsuariosController]', error);
      res.status(500).json({ error: 'Erro ao listar usuários do CRM' });
    }
  }

  /**
   * Criar um novo usuário para o cliente atual com permissões específicas
   */
  async criar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, email, senha, perfil, permissoes } = req.body;

      if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Campos obrigatórios: nome, email e senha.' });
      }

      const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
      if (usuarioExistente) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
      }

      const salt = await bcrypt.genSalt(10);
      const senhaHasheada = await bcrypt.hash(senha, salt);

      const novoUsuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHasheada,
          clienteId,
          perfil: perfil || 'CLIENT',
          permissoes: permissoes || {} // Objeto JSON de permissões
        },
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          // permissoes: true
        }
      });

      res.status(201).json(novoUsuario);
    } catch (error) {
      console.error('[CrmUsuariosController]', error);
      res.status(500).json({ error: 'Erro ao criar usuário do CRM' });
    }
  }

  /**
   * Atualizar dados e permissões de um usuário do cliente
   */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, email, senha, perfil, permissoes } = req.body;

      // Garantir que o usuário a ser editado pertence ao mesmo cliente
      const usuarioOriginal = await prisma.usuario.findFirst({
        where: { id, clienteId }
      });

      if (!usuarioOriginal) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const dadosParaAtualizar = {
        nome,
        email,
        perfil,
        permissoes
      };

      if (senha) {
        const salt = await bcrypt.genSalt(10);
        dadosParaAtualizar.senha = await bcrypt.hash(senha, salt);
      }

      const usuarioAtualizado = await prisma.usuario.update({
        where: { id },
        data: dadosParaAtualizar,
        select: {
          id: true,
          nome: true,
          email: true,
          perfil: true,
          // permissoes: true
        }
      });

      res.json(usuarioAtualizado);
    } catch (error) {
      console.error('[CrmUsuariosController]', error);
      res.status(500).json({ error: 'Erro ao atualizar usuário do CRM' });
    }
  }

  /**
   * Excluir um usuário do cliente
   */
  async excluir(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const usuarioOriginal = await prisma.usuario.findFirst({
        where: { id, clienteId }
      });

      if (!usuarioOriginal) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      if (id === req.usuario.id) {
        return res.status(400).json({ error: 'Você não pode excluir o seu próprio usuário.' });
      }

      await prisma.usuario.delete({ where: { id } });
      res.json({ message: 'Usuário removido com sucesso.' });
    } catch (error) {
      console.error('[CrmUsuariosController]', error);
      res.status(500).json({ error: 'Erro ao excluir usuário do CRM' });
    }
  }
}

module.exports = new CrmUsuariosController();
