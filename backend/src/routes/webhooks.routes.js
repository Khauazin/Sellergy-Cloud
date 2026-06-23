// Webhooks externos (PSP) — Frente 2. SEM middlewareAutenticacao: quem chama e
// o provedor, nao um usuario logado. A autenticidade vem da assinatura HMAC
// (validada com o segredo do tenant) e o processamento e IDEMPOTENTE por
// (provedor, provedorCobrancaId) — webhook duplicado nao reprocessa o efeito.
// Ref: docs/erp-arquitetura-e-operacao.md §4.

const express = require('express');
const prisma = require('../prisma');
const { criarProvedor } = require('../adapters/pagamento');
const { carregarCredencialDecifrada } = require('../credenciais');
const { aplicarStatusCobranca } = require('../services/cobrancaPagamento');

const roteador = express.Router();

// POST /webhooks/pagamento/:provedor
// Fluxo: parse "cego" do id -> acha a Cobranca (e o tenant dono) -> carrega a
// credencial do tenant -> valida assinatura -> consulta status real -> aplica.
roteador.post('/pagamento/:provedor', async (req, res) => {
  const provedor = String(req.params.provedor || '').toUpperCase();
  try {
    // 1) Parse sem credencial so pra extrair o provedorCobrancaId do evento.
    let parserCego;
    try {
      parserCego = criarProvedor(provedor, { modo: 'fixture' });
    } catch {
      return res.status(404).json({ erro: 'Provedor desconhecido.' });
    }
    const previa = parserCego.parsearWebhook({ headers: req.headers, body: req.body });
    if (!previa || !previa.provedorCobrancaId) {
      return res.status(200).json({ ok: true, ignorado: 'evento sem cobranca' });
    }

    // 2) Acha a Cobranca (e, com ela, o tenant). Nao e nossa -> ignora sem erro.
    const cobranca = await prisma.cobranca.findFirst({
      where: { provedor, provedorCobrancaId: previa.provedorCobrancaId },
    });
    if (!cobranca) {
      return res.status(200).json({ ok: true, ignorado: 'cobranca desconhecida' });
    }

    // 3) Carrega config + credencial do tenant dono da cobranca.
    const config = await prisma.configuracaoPagamento.findUnique({ where: { clienteId: cobranca.clienteId } });
    const credencial = config?.credencialId
      ? await carregarCredencialDecifrada({ credencialId: config.credencialId, clienteId: cobranca.clienteId }).catch(() => null)
      : null;
    const psp = criarProvedor(provedor, { credencial, modo: 'fixture' });

    // 4) Valida a assinatura quando ha segredo configurado (webhookSecret no cofre).
    const segredo = credencial?.dados?.webhookSecret;
    if (segredo) {
      const ok = psp.verificarAssinatura({ headers: req.headers, rawBody: req.rawBody, segredo });
      if (!ok) {
        console.warn(`[webhook/pagamento] assinatura invalida (provedor=${provedor}, cobranca=${cobranca.id}).`);
        return res.status(401).json({ erro: 'assinatura invalida' });
      }
    }

    // 5) Status definitivo: muitos PSP mandam so o id no webhook — consulta o
    //    status real antes de aplicar. aplicarStatusCobranca e idempotente.
    let status = previa.status;
    let pagoEm = previa.pagoEm;
    try {
      const atual = await psp.consultarStatus(cobranca.provedorCobrancaId);
      status = atual.status;
      pagoEm = atual.pagoEm;
    } catch (errConsulta) {
      // Sem conseguir confirmar o status real, nao arrisca aplicar PAGO. Loga
      // e responde 200 (PSP nao precisa re-tentar — o sync manual cobre depois).
      console.error(`[webhook/pagamento ${provedor}] falha ao consultar status:`, errConsulta?.message || errConsulta);
      return res.status(200).json({ ok: true, aviso: 'status nao confirmado' });
    }

    await aplicarStatusCobranca(cobranca, status, pagoEm);
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Erro inesperado: 500 pra o PSP re-tentar a entrega (idempotencia cobre).
    console.error(`[webhook/pagamento ${provedor}]`, e);
    return res.status(500).json({ erro: 'Erro ao processar webhook.' });
  }
});

module.exports = roteador;
