const express = require('express');
const prisma = require('../prisma');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { requerAdmin } = require('../middlewares/permissoes.middleware');
const { modulosLiberadosPorSegmento } = require('../utils/modulosSegmento');
const bcrypt = require('bcryptjs');

const roteador = express.Router();

// Apenas o ADMIN do sistema gerencia clientes.
roteador.use(middlewareAutenticacao);
roteador.use(requerAdmin);

roteador.get('/', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { criadoEm: 'desc' }
    });
    res.json(clientes);
  } catch (erro) {
    console.error('[clientes/list]', erro);
    res.status(500).json({ erro: 'Erro ao listar clientes' });
  }
});

roteador.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        bots: {
          // apiKeyIa nunca volta para o frontend.
          select: {
            id: true,
            nome: true,
            canal: true,
            status: true,
            telefone: true,
            criadoEm: true,
          }
        },
      }
    });

    if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado' });

    res.json(cliente);
  } catch (erro) {
    console.error('[clientes/get]', erro);
    res.status(500).json({ erro: 'Erro ao buscar detalhes do cliente' });
  }
});

roteador.post('/', async (req, res) => {
  try {
    const { nome, email, telefone, segmento, plano, mensalidade, modulosLiberados } = req.body;

    const SEGMENTOS_VALIDOS = ['SERVICO', 'PRODUTO', 'HIBRIDO'];
    const segmentoNormalizado = segmento ? String(segmento).toUpperCase() : null;
    if (segmentoNormalizado && !SEGMENTOS_VALIDOS.includes(segmentoNormalizado)) {
      return res.status(400).json({ erro: `Segmento invalido. Use: ${SEGMENTOS_VALIDOS.join(', ')}.` });
    }

    if (!email) {
      return res.status(400).json({ erro: 'O e-mail eh obrigatorio para gerar o acesso do cliente.' });
    }

    if (!nome) {
      return res.status(400).json({ erro: 'O nome eh obrigatorio.' });
    }

    // Modulos liberados: a matriz explicita do admin tem prioridade; sem ela,
    // auto-ativa o conjunto do segmento (onboarding sem atrito — Fase 3.1).
    const matrizExplicita = modulosLiberados && typeof modulosLiberados === 'object' && !Array.isArray(modulosLiberados)
      ? Object.fromEntries(Object.entries(modulosLiberados).filter(([, v]) => typeof v === 'boolean'))
      : {};
    const modulosFinais = Object.keys(matrizExplicita).length > 0
      ? matrizExplicita
      : modulosLiberadosPorSegmento(segmentoNormalizado);

    // Usar transacao para garantir integridade
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Criar o Cliente
      const cliente = await tx.cliente.create({
        data: {
          nome,
          email,
          telefone,
          segmento: segmentoNormalizado,
          plano,
          mensalidade: Number(mensalidade || 0),
          modulosLiberados: modulosFinais
        }
      });

      // 2. Criar o Usuario "dono" do cliente.
      // Senha padrao 123456 - intencional na UX de onboarding;
      // deveTrocarSenha=true forca a troca no primeiro login.
      const senhaPadrao = '123456';
      const senhaHasheada = await bcrypt.hash(senhaPadrao, 12);

      await tx.usuario.create({
        data: {
          nome: nome,
          email: email,
          senha: senhaHasheada,
          perfil: 'CLIENT',
          clienteId: cliente.id,
          deveTrocarSenha: true,
        }
      });

      // Sem categorias pré-cadastradas: o tenant nasce vazio e o usuário cria
      // as próprias categorias (com o devido "uso") na tela de Configurações.
      return cliente;
    });

    res.status(201).json(resultado);
  } catch (erro) {
    console.error('[clientes/create]', erro);
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Este e-mail ja esta sendo usado por outro cliente ou usuario.' });
    }
    res.status(500).json({ erro: 'Erro ao criar cliente e acesso.' });
  }
});

roteador.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, telefone, segmento, plano, status, mensalidade } = req.body;

    const SEGMENTOS_VALIDOS = ['SERVICO', 'PRODUTO', 'HIBRIDO'];
    const segmentoNormalizado = segmento ? String(segmento).toUpperCase() : null;
    if (segmentoNormalizado && !SEGMENTOS_VALIDOS.includes(segmentoNormalizado)) {
      return res.status(400).json({ erro: `Segmento invalido. Use: ${SEGMENTOS_VALIDOS.join(', ')}.` });
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nome, email, telefone, segmento: segmentoNormalizado, plano, status, mensalidade: Number(mensalidade || 0) }
    });
    res.json(cliente);
  } catch (erro) {
    console.error('[clientes/update]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar cliente' });
  }
});

// Atualiza apenas os modulos liberados para o cliente (matriz de permissoes do admin).
roteador.put('/:id/modulos', async (req, res) => {
  try {
    const { id } = req.params;
    const { modulosLiberados } = req.body;

    if (!modulosLiberados || typeof modulosLiberados !== 'object' || Array.isArray(modulosLiberados)) {
      return res.status(400).json({ erro: 'modulosLiberados deve ser um objeto.' });
    }

    // Sanitiza: aceita apenas booleanos, descarta o resto.
    const limpo = {};
    for (const [chave, valor] of Object.entries(modulosLiberados)) {
      if (typeof valor === 'boolean') limpo[chave] = valor;
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: { modulosLiberados: limpo },
      select: { id: true, nome: true, modulosLiberados: true }
    });

    res.json(cliente);
  } catch (erro) {
    console.error('[clientes/modulos]', erro);
    res.status(500).json({ erro: 'Erro ao atualizar modulos liberados.' });
  }
});

roteador.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusValidos = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ erro: 'Status invalido.' });
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: { status }
    });
    res.json(cliente);
  } catch (erro) {
    console.error('[clientes/status]', erro);
    res.status(500).json({ erro: 'Erro ao alterar status do cliente' });
  }
});

roteador.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.cliente.delete({ where: { id } });
    res.json({ message: 'Cliente excluido com sucesso' });
  } catch (error) {
    console.error('[clientes/delete]', error);
    res.status(500).json({ error: 'Erro ao excluir cliente. Verifique se ele possui bots vinculados.' });
  }
});

module.exports = roteador;
