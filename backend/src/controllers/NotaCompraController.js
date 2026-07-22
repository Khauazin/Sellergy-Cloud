const prisma = require('../prisma');
const { calcularPreco } = require('../produto');
const { parseNfe } = require('../utils/nfeSeguro');

const MAX_ITENS = 200;
const NOME_CATEGORIA_COMPRA = 'Compra de mercadorias';

const arredondar = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Acha (ou cria) a categoria de despesa "Compra de mercadorias" do tenant.
// É o termo contábil padrão pra entrada de mercadoria; despesa VARIAVEL (anda
// com o volume de compras). Criada sob demanda na 1ª nota.
async function categoriaCompra(tx, clienteId) {
  let cat = await tx.categoriaFinanceira.findFirst({
    where: { clienteId, nome: NOME_CATEGORIA_COMPRA, tipo: 'DESPESA' },
  });
  if (!cat) {
    cat = await tx.categoriaFinanceira.create({
      data: { clienteId, nome: NOME_CATEGORIA_COMPRA, tipo: 'DESPESA', subTipo: 'VARIAVEL' },
    });
  }
  return cat;
}

const INCLUDE_NOTA = {
  fornecedor: { select: { id: true, nome: true, cnpj: true } },
  movimentacoes: {
    include: { variacao: { include: { produto: { select: { id: true, nome: true } } } } },
  },
};

class NotaCompraController {
  /**
   * Registra a entrada de uma nota de compra (manual). Numa transação:
   *  1. cria a NotaCompra (cabeçalho);
   *  2. pra cada item: movimentação COMPRA_FORNECEDOR (+estoque, custo congelado),
   *     recalcula o custo MÉDIO ponderado e o preço (custo+lucro) da variação;
   *  3. lança a despesa "Compra de mercadorias" pelo total.
   * Produto deve ser FÍSICO e do tenant. Tudo ou nada.
   */
  async criar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });

      const { fornecedorId, numero, emitidaEm, observacoes, pago = true, itens } = req.body;

      if (!Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ erro: 'Inclua ao menos um item na nota.' });
      }
      if (itens.length > MAX_ITENS) {
        return res.status(400).json({ erro: `Itens demais (limite de ${MAX_ITENS}).` });
      }

      // Normaliza e valida cada item.
      const normalizados = [];
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        const variacaoId = it?.variacaoId;
        const quantidade = parseInt(it?.quantidade, 10);
        const custoUnitario = Number(it?.custoUnitario);
        if (!variacaoId || typeof variacaoId !== 'string') {
          return res.status(400).json({ erro: `Item ${i + 1}: produto inválido.` });
        }
        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          return res.status(400).json({ erro: `Item ${i + 1}: quantidade deve ser maior que zero.` });
        }
        if (!Number.isFinite(custoUnitario) || custoUnitario < 0) {
          return res.status(400).json({ erro: `Item ${i + 1}: custo unitário inválido.` });
        }
        normalizados.push({ variacaoId, quantidade, custoUnitario: arredondar(custoUnitario) });
      }

      // Fornecedor do tenant (se informado).
      let fornecedor = null;
      if (fornecedorId) {
        fornecedor = await prisma.fornecedor.findFirst({ where: { id: fornecedorId, clienteId } });
        if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
      }

      // Carrega as variações (valida tenant + que são FÍSICO).
      const ids = [...new Set(normalizados.map((n) => n.variacaoId))];
      const variacoes = await prisma.variacaoProduto.findMany({
        where: { id: { in: ids }, produto: { clienteId } },
        include: { produto: true },
      });
      const mapaVar = new Map(variacoes.map((v) => [v.id, v]));
      for (const n of normalizados) {
        const v = mapaVar.get(n.variacaoId);
        if (!v) return res.status(404).json({ erro: 'Um dos produtos não foi encontrado.' });
        if (v.produto.tipo !== 'FISICO') {
          return res.status(422).json({ erro: `"${v.produto.nome}" não é um produto físico; não entra em nota de compra.` });
        }
      }

      const valorTotal = arredondar(
        normalizados.reduce((s, n) => s + n.quantidade * n.custoUnitario, 0),
      );

      const novaNota = await prisma.$transaction(async (tx) => {
        const nota = await tx.notaCompra.create({
          data: {
            clienteId,
            fornecedorId: fornecedor?.id || null,
            numero: numero ? String(numero).slice(0, 60) : null,
            origem: 'MANUAL',
            valorTotal,
            observacoes: observacoes ? String(observacoes).slice(0, 500) : null,
            emitidaEm: emitidaEm ? new Date(emitidaEm) : null,
          },
        });

        // Cada item: movimentação de entrada + recálculo de custo médio e preço.
        for (const n of normalizados) {
          const v = mapaVar.get(n.variacaoId);
          const estoqueAtual = v.estoqueAtual || 0;
          const custoAtual = v.precoCusto || 0;
          const novaQtd = estoqueAtual + n.quantidade;
          // Custo médio ponderado. Sem estoque anterior (ou negativo), usa o custo da nota.
          const novoCusto = novaQtd > 0
            ? arredondar((estoqueAtual * custoAtual + n.quantidade * n.custoUnitario) / novaQtd)
            : arredondar(n.custoUnitario);
          const novoPreco = calcularPreco(novoCusto, v.lucroTipo, v.lucroValor);

          await tx.movimentacaoEstoque.create({
            data: {
              variacaoId: v.id,
              tipo: 'COMPRA_FORNECEDOR',
              quantidade: n.quantidade,
              custoUnitario: n.custoUnitario, // custo congelado desta entrada
              notaCompraId: nota.id,
              motivo: `Entrada de nota${nota.numero ? ` ${nota.numero}` : ''}`,
            },
          });

          await tx.variacaoProduto.update({
            where: { id: v.id },
            data: {
              estoqueAtual: { increment: n.quantidade },
              precoCusto: novoCusto,
              preco: novoPreco,
            },
          });

          // Atualiza em memória caso a mesma variação apareça em outra linha.
          v.estoqueAtual = novaQtd;
          v.precoCusto = novoCusto;
        }

        // Despesa "Compra de mercadorias" pelo total da nota.
        const cat = await categoriaCompra(tx, clienteId);
        const ehPago = pago !== false && pago !== 'false';
        await tx.lancamentoFinanceiro.create({
          data: {
            clienteId,
            categoriaId: cat.id,
            descricao: `Compra de mercadorias${fornecedor ? ` — ${fornecedor.nome}` : ''}${nota.numero ? ` (nota ${nota.numero})` : ''}`,
            valor: valorTotal,
            tipo: 'DESPESA',
            status: ehPago ? 'PAGO' : 'PENDENTE',
            dataVencimento: nota.emitidaEm || new Date(),
            dataPagamento: ehPago ? new Date() : null,
          },
        });

        return nota;
      });

      const completa = await prisma.notaCompra.findFirst({
        where: { id: novaNota.id, clienteId },
        include: INCLUDE_NOTA,
      });
      res.status(201).json(completa);
    } catch (erro) {
      console.error('[notas-compra/criar]', erro);
      res.status(500).json({ erro: 'Erro ao registrar a entrada de nota.' });
    }
  }

  /**
   * Lê o XML de uma NF-e e devolve um PREVIEW (sem gravar nada). O parser é
   * defensivo (anti-XXE/DoS — ver utils/nfeSeguro). Tenta casar o fornecedor
   * pelo CNPJ. O usuário confere, mapeia cada item a um produto seu e confirma
   * via POST /notas-compra (criar).
   */
  async importarXml(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });
      if (!req.file?.buffer) return res.status(400).json({ erro: 'Envie o XML da NF-e no campo "arquivo".' });

      let dados;
      try {
        dados = parseNfe(req.file.buffer);
      } catch (e) {
        if (e.code === 'XML_INVALIDO') return res.status(422).json({ erro: e.message });
        throw e;
      }

      // Tenta casar o fornecedor pelo CNPJ da nota (não grava nada).
      let fornecedor = null;
      const cnpj = dados.fornecedor?.cnpj || '';
      if (cnpj.length === 14) {
        fornecedor = await prisma.fornecedor.findFirst({
          where: { clienteId, cnpj },
          select: { id: true, nome: true },
        });
      }

      res.json({
        numero: dados.numero,
        emitidaEm: dados.emitidaEm,
        fornecedorXml: dados.fornecedor, // { cnpj, nome } lidos da nota
        fornecedor,                      // { id, nome } se já cadastrado; senão null
        itens: dados.itens,              // [{ codigo, descricao, quantidade, custoUnitario }]
      });
    } catch (erro) {
      console.error('[notas-compra/importar-xml]', erro);
      res.status(500).json({ erro: 'Erro ao ler o XML da NF-e.' });
    }
  }

  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });

      const notas = await prisma.notaCompra.findMany({
        where: { clienteId },
        orderBy: { criadoEm: 'desc' },
        take: 200,
        include: {
          fornecedor: { select: { id: true, nome: true } },
          _count: { select: { movimentacoes: true } },
        },
      });
      res.json(notas);
    } catch (erro) {
      console.error('[notas-compra/listar]', erro);
      res.status(500).json({ erro: 'Erro ao listar notas de compra.' });
    }
  }

  async buscarPorId(req, res) {
    try {
      const { clienteId } = req.usuario;
      const nota = await prisma.notaCompra.findFirst({
        where: { id: req.params.id, clienteId },
        include: INCLUDE_NOTA,
      });
      if (!nota) return res.status(404).json({ erro: 'Nota não encontrada.' });
      res.json(nota);
    } catch (erro) {
      console.error('[notas-compra/buscarPorId]', erro);
      res.status(500).json({ erro: 'Erro ao buscar nota.' });
    }
  }
}

module.exports = new NotaCompraController();
