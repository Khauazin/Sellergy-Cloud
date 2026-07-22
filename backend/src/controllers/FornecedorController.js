const prisma = require('../prisma');
const { parseCsv } = require('../utils/csvSeguro');

// ---------- normalizacao / validacao ----------
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NOME = 120;
const MAX_EMAIL = 160;
const MAX_OBS = 500;

const soDigitos = (s) => String(s ?? '').replace(/\D+/g, '');

function limparTexto(v, max) {
  const s = String(v ?? '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

// Monta o `data` validado a partir de um payload solto (criar/editar).
// Retorna { data } ou { erro } com mensagem amigavel.
function montarDados(body, { parcial = false } = {}) {
  const data = {};

  if (!parcial || body?.nome !== undefined) {
    const nome = limparTexto(body?.nome, MAX_NOME);
    if (!nome) return { erro: 'O nome do fornecedor e obrigatorio.' };
    data.nome = nome;
  }
  if (!parcial || body?.cnpj !== undefined) {
    const cnpj = soDigitos(body?.cnpj);
    if (cnpj && cnpj.length !== 14) return { erro: 'CNPJ deve ter 14 digitos.' };
    data.cnpj = cnpj || null;
  }
  if (!parcial || body?.email !== undefined) {
    const email = limparTexto(body?.email, MAX_EMAIL);
    if (email && !RE_EMAIL.test(email)) return { erro: 'E-mail invalido.' };
    data.email = email || null;
  }
  if (!parcial || body?.telefone !== undefined) {
    data.telefone = soDigitos(body?.telefone) || null;
  }
  if (!parcial || body?.observacoes !== undefined) {
    data.observacoes = limparTexto(body?.observacoes, MAX_OBS) || null;
  }
  if (body?.ativo !== undefined) {
    data.ativo = body.ativo === false || body.ativo === 'false' ? false : true;
  }
  return { data };
}

class FornecedorController {
  async listar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });

      const { q, ativo } = req.query;
      const where = { clienteId };
      if (ativo === 'true') where.ativo = true;
      else if (ativo === 'false') where.ativo = false;

      const termo = String(q || '').trim();
      if (termo) {
        const or = [
          { nome: { contains: termo, mode: 'insensitive' } },
          { email: { contains: termo, mode: 'insensitive' } },
        ];
        const digitos = soDigitos(termo);
        if (digitos) or.push({ cnpj: { contains: digitos } });
        where.OR = or;
      }

      const fornecedores = await prisma.fornecedor.findMany({ where, orderBy: { nome: 'asc' } });
      res.json(fornecedores);
    } catch (erro) {
      console.error('[fornecedores/listar]', erro);
      res.status(500).json({ erro: 'Erro ao listar fornecedores.' });
    }
  }

  async buscarPorId(req, res) {
    try {
      const { clienteId } = req.usuario;
      const fornecedor = await prisma.fornecedor.findFirst({ where: { id: req.params.id, clienteId } });
      if (!fornecedor) return res.status(404).json({ erro: 'Fornecedor nao encontrado.' });
      res.json(fornecedor);
    } catch (erro) {
      console.error('[fornecedores/buscarPorId]', erro);
      res.status(500).json({ erro: 'Erro ao buscar fornecedor.' });
    }
  }

  async criar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });

      const { data, erro } = montarDados(req.body);
      if (erro) return res.status(400).json({ erro });

      // Dedupe por CNPJ dentro do tenant.
      if (data.cnpj) {
        const existe = await prisma.fornecedor.findFirst({ where: { clienteId, cnpj: data.cnpj } });
        if (existe) return res.status(409).json({ erro: 'Ja existe um fornecedor com esse CNPJ.' });
      }

      const fornecedor = await prisma.fornecedor.create({ data: { clienteId, ...data } });
      res.status(201).json(fornecedor);
    } catch (erro) {
      console.error('[fornecedores/criar]', erro);
      res.status(500).json({ erro: 'Erro ao criar fornecedor.' });
    }
  }

  async atualizar(req, res) {
    try {
      const { clienteId } = req.usuario;
      const atual = await prisma.fornecedor.findFirst({ where: { id: req.params.id, clienteId } });
      if (!atual) return res.status(404).json({ erro: 'Fornecedor nao encontrado.' });

      const { data, erro } = montarDados(req.body, { parcial: true });
      if (erro) return res.status(400).json({ erro });

      // Dedupe por CNPJ (ignorando o proprio registro).
      if (data.cnpj && data.cnpj !== atual.cnpj) {
        const existe = await prisma.fornecedor.findFirst({
          where: { clienteId, cnpj: data.cnpj, id: { not: atual.id } },
        });
        if (existe) return res.status(409).json({ erro: 'Ja existe um fornecedor com esse CNPJ.' });
      }

      const fornecedor = await prisma.fornecedor.update({ where: { id: atual.id }, data });
      res.json(fornecedor);
    } catch (erro) {
      console.error('[fornecedores/atualizar]', erro);
      res.status(500).json({ erro: 'Erro ao atualizar fornecedor.' });
    }
  }

  async excluir(req, res) {
    try {
      const { clienteId } = req.usuario;
      const r = await prisma.fornecedor.deleteMany({ where: { id: req.params.id, clienteId } });
      if (r.count === 0) return res.status(404).json({ erro: 'Fornecedor nao encontrado.' });
      res.json({ ok: true });
    } catch (erro) {
      console.error('[fornecedores/excluir]', erro);
      res.status(500).json({ erro: 'Erro ao excluir fornecedor.' });
    }
  }

  /**
   * Importacao em massa por CSV. O arquivo ja passou pelo filtro de upload
   * (extensao/tamanho); aqui o CONTEUDO e validado (parseCsv recusa binario,
   * limita linhas, neutraliza injecao de formula). Cada linha e validada
   * individualmente: linhas ruins sao puladas e reportadas, sem derrubar a
   * importacao inteira. Dedupe por CNPJ (no arquivo e contra o banco).
   */
  async importar(req, res) {
    try {
      const { clienteId } = req.usuario;
      if (!clienteId) return res.status(403).json({ erro: 'Acesso negado: usuario sem tenant.' });
      if (!req.file?.buffer) return res.status(400).json({ erro: 'Envie um arquivo CSV no campo "arquivo".' });

      let parsed;
      try {
        parsed = parseCsv(req.file.buffer);
      } catch (e) {
        if (e.code === 'CSV_INVALIDO') return res.status(422).json({ erro: e.message });
        throw e;
      }

      const { headers, rows } = parsed;
      const achaCol = (cands) => headers.find((h) => cands.includes(h));
      const colNome = achaCol(['nome', 'fornecedor', 'razao social', 'razao_social', 'nome fantasia']);
      if (!colNome) {
        return res.status(422).json({
          erro: 'O CSV precisa de uma coluna "nome". Baixe o modelo e use o mesmo cabecalho.',
        });
      }
      const colCnpj = achaCol(['cnpj', 'cnpj/cpf', 'documento']);
      const colEmail = achaCol(['email', 'e-mail']);
      const colTel = achaCol(['telefone', 'fone', 'celular', 'whatsapp']);
      const colObs = achaCol(['observacoes', 'observacao', 'obs', 'nota']);

      const ignorados = [];
      const candidatos = [];
      const cnpjsNoArquivo = new Set();

      rows.forEach((row, i) => {
        const linha = i + 2; // +1 do cabecalho, +1 pra virar base-1
        const nome = limparTexto(row[colNome], MAX_NOME);
        if (!nome) return ignorados.push({ linha, motivo: 'sem nome' });

        const cnpj = colCnpj ? soDigitos(row[colCnpj]) : '';
        if (cnpj && cnpj.length !== 14) {
          return ignorados.push({ linha, motivo: `CNPJ invalido (${cnpj.length} digitos)` });
        }
        const email = colEmail ? limparTexto(row[colEmail], MAX_EMAIL) : '';
        if (email && !RE_EMAIL.test(email)) {
          return ignorados.push({ linha, motivo: 'e-mail invalido' });
        }
        if (cnpj) {
          if (cnpjsNoArquivo.has(cnpj)) {
            return ignorados.push({ linha, motivo: 'CNPJ repetido no arquivo' });
          }
          cnpjsNoArquivo.add(cnpj);
        }

        candidatos.push({
          linha,
          data: {
            clienteId,
            nome,
            cnpj: cnpj || null,
            email: email || null,
            telefone: colTel ? (soDigitos(row[colTel]) || null) : null,
            observacoes: colObs ? (limparTexto(row[colObs], MAX_OBS) || null) : null,
            ativo: true,
          },
        });
      });

      // Dedupe contra o banco (por CNPJ) numa unica consulta.
      const cnpjs = [...cnpjsNoArquivo];
      let jaExistentes = new Set();
      if (cnpjs.length) {
        const existentes = await prisma.fornecedor.findMany({
          where: { clienteId, cnpj: { in: cnpjs } },
          select: { cnpj: true },
        });
        jaExistentes = new Set(existentes.map((e) => e.cnpj));
      }

      const aInserir = [];
      for (const c of candidatos) {
        if (c.data.cnpj && jaExistentes.has(c.data.cnpj)) {
          ignorados.push({ linha: c.linha, motivo: 'CNPJ ja cadastrado' });
          continue;
        }
        aInserir.push(c.data);
      }

      let criados = 0;
      if (aInserir.length) {
        const r = await prisma.fornecedor.createMany({ data: aInserir });
        criados = r.count;
      }

      res.json({
        total: rows.length,
        criados,
        ignorados: ignorados.length,
        detalhes: ignorados.slice(0, 50), // limita o tamanho da resposta
      });
    } catch (erro) {
      console.error('[fornecedores/importar]', erro);
      res.status(500).json({ erro: 'Erro ao importar fornecedores.' });
    }
  }
}

module.exports = new FornecedorController();
