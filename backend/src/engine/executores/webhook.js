// Trigger WEBHOOK: igual ao MANUAL — apenas propaga os dados do gatilho.
// Diferenca eh semantica (origem da execucao), nao logica.
// Os dadosGatilho aqui costumam trazer { canal, conversaId, mensagemId,
// telefone, texto, recebidoEm } quando vem do dispatcher de canais.
async function executar({ contexto }) {
  return { saida: contexto.dadosGatilho || {} };
}

module.exports = { executar };
