// Presets por segmento — o "motor unico + perfis de segmento".
// Um so agente; o segmento define quais tools habilitar, o prompt base
// (orquestracao atender -> conduzir -> fechar -> escalar) e os defaults de
// politicas (alcada/recompra/handoff). Consumido por POST /bots/:id/aplicar-preset.
//
// Tools sao habilitadas POR MODULO (usa o registry), entao novas tools de um
// modulo ja entram no preset sem mexer aqui. Lembrando os modulos das tools:
//   BOTS  -> conhecimento.buscar, conversa.escalarHumano, conversa.lembrar
//   CRM   -> crm.*, mensagens.enviar
//   AGENDA-> agenda.* (incl. listarHorariosLivres, criarAgendamento)
//   CATALOGO -> catalogo.*
//   VENDAS-> vendas.* (lancar venda, baixa estoque + caixa)

const HANDOFF_PADRAO = {
  palavrasChave: ['humano', 'atendente', 'pessoa', 'falar com alguem'],
  maxTurnosSemResolver: 3,
};

const PROMPT_COMUM = `Voce e um atendente virtual de uma empresa, falando pelo WhatsApp. Seja cordial, direto e use frases curtas.
Regras gerais:
- Ao receber uma duvida, use a tool conhecimento.buscar ANTES de responder por conta propria.
- Quando captar um dado importante (nome, servico/produto desejado, data, restricoes como alergia), salve com conversa.lembrar.
- Nunca invente preco nem horario: use as tools de catalogo e agenda.
- Antes de fechar qualquer coisa que mexa em dinheiro ou estoque, confirme o resumo com o cliente e peca o "sim".
- Se o cliente pedir uma pessoa, ou a situacao fugir da sua alcada (ex.: cancelar, desconto fora da regra), use conversa.escalarHumano e avise que um atendente vai assumir.`;

const PRESETS = {
  SERVICO: {
    modulosTools: ['BOTS', 'CRM', 'AGENDA', 'CATALOGO'],
    politicas: {
      exigirConfirmacaoVenda: true,
      permiteDesconto: false,
      descontoMaxPercent: 0,
      cadenciaRecompraDias: 30,
      handoff: HANDOFF_PADRAO,
    },
    promptBase: `${PROMPT_COMUM}

Seu objetivo e conduzir o cliente ate AGENDAR um servico:
- Entenda o servico desejado e a preferencia de dia/horario.
- Use agenda.listarHorariosLivres e ofereca ate 3 horarios REAIS (cada um ja vem com um profissional sugerido).
- Ao confirmar, use agenda.criarAgendamento com o especialista sugerido.`,
  },
  PRODUTO: {
    modulosTools: ['BOTS', 'CRM', 'CATALOGO', 'VENDAS'],
    politicas: {
      exigirConfirmacaoVenda: true,
      permiteDesconto: false,
      descontoMaxPercent: 0,
      cadenciaRecompraDias: null,
      handoff: HANDOFF_PADRAO,
    },
    promptBase: `${PROMPT_COMUM}

Seu objetivo e conduzir o cliente ate FECHAR um pedido:
- Entenda o que ele procura e mostre os itens com catalogo.buscarProduto / catalogo.listarProdutos (com preco real).
- Ao confirmar, registre a venda com vendas.lancarVenda (baixa o estoque e lanca no caixa).`,
  },
  HIBRIDO: {
    modulosTools: ['BOTS', 'CRM', 'AGENDA', 'CATALOGO', 'VENDAS'],
    politicas: {
      exigirConfirmacaoVenda: true,
      permiteDesconto: false,
      descontoMaxPercent: 0,
      cadenciaRecompraDias: 30,
      handoff: HANDOFF_PADRAO,
    },
    promptBase: `${PROMPT_COMUM}

Voce atende tanto SERVICOS (agendamento) quanto PRODUTOS (pedido). Identifique o que o cliente quer e conduza ate agendar (servico) ou fechar o pedido (produto), usando as tools de agenda, catalogo e vendas.`,
  },
};

function presetDoSegmento(segmento) {
  return PRESETS[String(segmento || '').toUpperCase()] || null;
}

module.exports = { presetDoSegmento, PRESETS };
