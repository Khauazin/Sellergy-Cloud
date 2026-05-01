// Receiver publico de webhooks. Sem autenticacao JWT — protecao por
// (a) `webhookId` opaco na URL, (b) HMAC opcional via header.
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const { criarExecucaoPendente } = require('../engine');
const { enfileirarExecucao } = require('../filas');

const roteador = express.Router();

const TAMANHO_MAX_BYTES = 1_000_000; // 1MB
const HEADER_ASSINATURA = 'x-webhook-signature';

// Rate limit por IP. 60 chamadas por minuto.
const limitador = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisicoes. Aguarde antes de chamar novamente.' },
});

// Body raw em buffer para que possamos verificar HMAC sobre o byte-stream
// recebido. O JSON parse acontece DEPOIS da verificacao.
const corpoBruto = express.raw({ type: '*/*', limit: TAMANHO_MAX_BYTES });

function comparaTimingSafe(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function calcularHmac(corpo, segredo) {
  return crypto.createHmac('sha256', segredo).update(corpo).digest('hex');
}

function tentarParsearJson(buffer, contentType) {
  if (!buffer || buffer.length === 0) return null;
  const texto = buffer.toString('utf8');
  if (contentType && contentType.toLowerCase().includes('application/json')) {
    try {
      return JSON.parse(texto);
    } catch {
      return null;
    }
  }
  // tenta JSON oportunisticamente
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

roteador.post('/:webhookId', limitador, corpoBruto, async (req, res) => {
  try {
    const { webhookId } = req.params;
    if (typeof webhookId !== 'string' || !webhookId) {
      return res.status(400).json({ erro: 'webhookId invalido.' });
    }

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId },
      select: {
        id: true,
        fluxoId: true,
        noId: true,
        segredo: true,
        ativo: true,
        exigirHmac: true,
      },
    });
    if (!webhook || !webhook.ativo) {
      return res.status(404).json({ erro: 'Webhook nao encontrado ou inativo.' });
    }

    // Verifica HMAC quando exigido.
    if (webhook.exigirHmac) {
      const enviada = req.header(HEADER_ASSINATURA);
      if (!enviada) {
        return res.status(401).json({ erro: 'Assinatura HMAC ausente.' });
      }
      const esperada = calcularHmac(req.body || Buffer.alloc(0), webhook.segredo);
      const limpa = enviada.replace(/^sha256=/i, '');
      if (!comparaTimingSafe(limpa, esperada)) {
        return res.status(401).json({ erro: 'Assinatura HMAC invalida.' });
      }
    }

    const corpo = tentarParsearJson(req.body, req.header('content-type'));

    const dadosGatilho = {
      corpo,
      cabecalhos: req.headers,
      query: req.query || {},
      ip: req.ip,
      recebidoEm: new Date().toISOString(),
    };

    const execucao = await criarExecucaoPendente({
      fluxoId: webhook.fluxoId,
      dadosGatilho,
      modo: 'WEBHOOK',
    });

    await prisma.execucao.update({
      where: { id: execucao.id },
      data: { noTriggerId: webhook.noId },
    });

    try {
      await enfileirarExecucao({ execucaoId: execucao.id });
    } catch (erro) {
      console.error('[webhook/enfileirar]', erro);
      await prisma.execucao.update({
        where: { id: execucao.id },
        data: { status: 'ERRO', finalizadaEm: new Date(), erro: 'Falha ao enfileirar.' },
      });
      return res.status(503).json({ erro: 'Servico de filas indisponivel.' });
    }

    // Atualiza estatisticas do webhook (best-effort, nao bloqueia resposta).
    prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        ultimaChamadaEm: new Date(),
        totalChamadas: { increment: 1 },
      },
    }).catch((e) => console.error('[webhook/stats]', e));

    res.status(202).json({ execucaoId: execucao.id });
  } catch (erro) {
    console.error('[webhook/receber]', erro);
    res.status(500).json({ erro: 'Erro ao processar webhook.' });
  }
});

module.exports = roteador;
