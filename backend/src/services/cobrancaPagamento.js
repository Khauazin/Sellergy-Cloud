// Aplicacao idempotente de status de Cobranca + efeito de confirmacao.
// Compartilhado pelo webhook (confirmacao automatica) e pela sincronizacao
// manual — os dois caminhos passam por aqui pra a regra ser unica.

const prisma = require('../prisma');

// Campos seguros pra devolver (sem o payload bruto do PSP).
const CAMPOS_COBRANCA = {
  id: true, origem: true, refId: true, valor: true, metodo: true,
  status: true, provedor: true, provedorCobrancaId: true, qrCode: true,
  linkUrl: true, vencimento: true, pagoEm: true, criadoEm: true, atualizadoEm: true,
};

// Efeito de confirmacao (a "baixa"). Roda UMA vez, na transicao p/ PAGO.
//
// A integracao profunda com financeiro/caixa (LancamentoFinanceiro RECEITA PAGO,
// sessao de caixa, baixa da venda/agendamento de origem) depende do fluxo de
// Caixa e fica como SEAM explicito — nao acoplo logica de caixa nao testada
// aqui. Quando o Financeiro entrar nessa costura, e so preencher esta funcao.
async function aplicarEfeitoConfirmacao(cobranca) {
  // TODO(Frente 2 + Financeiro): por origem (VENDA/AGENDAMENTO + refId), baixar o
  // registro e gerar LancamentoFinanceiro RECEITA PAGO vinculado.
  console.log(
    `[pagamento] Cobranca ${cobranca.id} confirmada `
    + `(origem=${cobranca.origem}, ref=${cobranca.refId || '-'}, valor=${cobranca.valor}).`
  );
}

// Aplica um status na Cobranca de forma IDEMPOTENTE. O efeito de confirmacao so
// dispara na PRIMEIRA vez que a cobranca vira PAGO (webhook duplicado nao
// reprocessa). Nao "rebaixa" um PAGO/ESTORNADO de volta a PENDENTE.
async function aplicarStatusCobranca(cobranca, novoStatus, pagoEm) {
  const TERMINAIS = new Set(['PAGO', 'ESTORNADO', 'CANCELADO', 'EXPIRADO']);
  const jaPago = cobranca.status === 'PAGO';

  // Ja em estado terminal e o novo nao acrescenta nada -> no-op (idempotencia).
  if (TERMINAIS.has(cobranca.status) && cobranca.status === novoStatus) {
    return prisma.cobranca.findUnique({ where: { id: cobranca.id }, select: CAMPOS_COBRANCA });
  }
  // Nao deixa um PAGO voltar pra PENDENTE por evento atrasado/fora de ordem.
  if (jaPago && novoStatus === 'PENDENTE') {
    return prisma.cobranca.findUnique({ where: { id: cobranca.id }, select: CAMPOS_COBRANCA });
  }

  const data = { status: novoStatus };
  if (novoStatus === 'PAGO') data.pagoEm = pagoEm ? new Date(pagoEm) : new Date();

  const atualizada = await prisma.cobranca.update({
    where: { id: cobranca.id },
    data,
    select: CAMPOS_COBRANCA,
  });

  if (novoStatus === 'PAGO' && !jaPago) {
    await aplicarEfeitoConfirmacao(atualizada);
  }
  return atualizada;
}

module.exports = { aplicarStatusCobranca, aplicarEfeitoConfirmacao, CAMPOS_COBRANCA };
