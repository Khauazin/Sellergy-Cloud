const prisma = require('../prisma');

class CatalogoController {
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { buscar, categoriaId, tipo, visibilidade } = req.query;

      const onde = {
        clienteId,
        nome: buscar ? { contains: buscar, mode: 'insensitive' } : undefined,
        categoriaId: categoriaId || undefined,
        tipo: tipo || undefined,
        visibilidade: visibilidade || undefined
      };

      const produtos = await prisma.produto.findMany({
        where: onde,
        include: { variacoes: true, categoria: true },
        orderBy: { nome: 'asc' }
      });
      res.json(produtos);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar catálogo' });
    }
  }

  async criar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, descricao, tipo, visibilidade, variacoes, categoriaId } = req.body;

      // Validação de Categoria Financeira (obrigatória conforme regra de negócio)
      if (!categoriaId) {
        return res.status(422).json({ error: 'categoriaId é obrigatório.', campos: ['categoriaId'] });
      }

      const categoriaExiste = await prisma.categoriaFinanceira.findFirst({
        where: { id: categoriaId, clienteId }
      });

      if (!categoriaExiste) {
        return res.status(400).json({ error: 'Categoria financeira não encontrada ou não pertence ao cliente.' });
      }

      const produto = await prisma.produto.create({
        data: {
          clienteId,
          categoriaId,
          nome,
          descricao,
          tipo,
          visibilidade,
          variacoes: variacoes ? {
            create: variacoes
          } : undefined
        },
        include: { variacoes: true }
      });

      res.status(201).json(produto);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro ao criar produto' });
    }
  }

  async buscarPorId(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const produto = await prisma.produto.findFirst({
        where: { id, clienteId },
        include: { variacoes: true }
      });

      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar produto' });
    }
  }

  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const { nome, descricao, tipo, visibilidade } = req.body;

      const produto = await prisma.produto.update({
        where: { id, clienteId },
        data: { nome, descricao, tipo, visibilidade }
      });

      res.json(produto);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
  }

  async excluir(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const movimentacoes = await prisma.movimentacaoEstoque.count({
        where: {
          variacao: { produtoId: id, produto: { clienteId } }
        }
      });

      if (movimentacoes > 0) {
        return res.status(422).json({
          error: 'Não é possível excluir um produto que possui movimentações de estoque registradas.'
        });
      }

      await prisma.produto.delete({
        where: { id, clienteId }
      });

      res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir produto' });
    }
  }

  // CRUD de Variações Individual
  async criarVariacao(req, res) {
    try {
      const { produtoId } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const dados = req.body;

      const produto = await prisma.produto.findFirst({ where: { id: produtoId, clienteId } });
      if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

      const variacao = await prisma.variacaoProduto.create({
        data: { ...dados, produtoId }
      });
      res.status(201).json(variacao);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar variação' });
    }
  }

  async editarVariacao(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });
      const dados = req.body;

      const variacao = await prisma.variacaoProduto.findFirst({
        where: { id, produto: { clienteId } }
      });
      if (!variacao) return res.status(404).json({ error: 'Variação não encontrada' });

      const atualizada = await prisma.variacaoProduto.update({
        where: { id },
        data: dados
      });
      res.json(atualizada);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao editar variação' });
    }
  }

  async excluirVariacao(req, res) {
    try {
      const { id } = req.params;
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ error: 'Acesso negado: ID do cliente ausente.' });

      const movimentacoes = await prisma.movimentacaoEstoque.count({
        where: { variacaoId: id, variacao: { produto: { clienteId } } }
      });

      if (movimentacoes > 0) {
        return res.status(422).json({ error: 'Variação possui movimentações e não pode ser excluída.' });
      }

      await prisma.variacaoProduto.delete({ where: { id } });
      res.json({ message: 'Variação excluída' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao excluir variação' });
    }
  }
}

module.exports = new CatalogoController();
