// =====================================================================
// CATALOGO DE ETAPAS DO FUNIL DE CRM
// =====================================================================
// Lista curada de etapas pre-definidas que o tenant pode habilitar/desabilitar.
// Cada etapa tem:
//   - slug:  identificador estavel (usado pra evitar duplicata e referenciar)
//   - nome:  exibido na UI
//   - cor:   hex pra badge/coluna do kanban
//   - ordem: posicao sugerida no funil (asc = topo)
//
// Quando o tenant habilita uma etapa, criamos uma linha em EtapaLead com
// esse slug. Quando desabilita, deletamos (bloqueado se houver leads).
//
// IMPORTANTE: manter slugs estaveis. Mudar slug = quebrar tenants existentes.
// Pra renomear, edite so 'nome'; pra reordenar visualmente, ajuste 'ordem'.

const ETAPAS_CATALOGO = [
  { slug: 'novo',                nome: 'Novo',                cor: '#3B82F6', ordem: 1, descricao: 'Lead chegou, primeiro contato pendente.' },
  { slug: 'em-contato',          nome: 'Em contato',          cor: '#06B6D4', ordem: 2, descricao: 'Ja conversamos, em qualificacao.' },
  { slug: 'qualificado',         nome: 'Qualificado',         cor: '#8B5CF6', ordem: 3, descricao: 'Interessado, tem orcamento, perfil ok.' },
  { slug: 'em-negociacao',       nome: 'Em negociacao',       cor: '#F97316', ordem: 4, descricao: 'Discutindo condicoes e proposta.' },
  { slug: 'proposta-enviada',    nome: 'Proposta enviada',    cor: '#EAB308', ordem: 5, descricao: 'Aguardando resposta do cliente.' },
  { slug: 'fechado-ganho',       nome: 'Fechado - Ganho',     cor: '#22C55E', ordem: 6, descricao: 'Virou cliente.' },
  { slug: 'fechado-perdido',     nome: 'Fechado - Perdido',   cor: '#EF4444', ordem: 7, descricao: 'Nao fechou — registrar motivo nas observacoes.' },
  { slug: 'em-pausa',            nome: 'Em pausa',            cor: '#6B7280', ordem: 8, descricao: 'Sem acao por enquanto, retomar depois.' },
];

const SLUGS_VALIDOS = new Set(ETAPAS_CATALOGO.map((e) => e.slug));

function buscarEtapaCatalogo(slug) {
  return ETAPAS_CATALOGO.find((e) => e.slug === slug) || null;
}

module.exports = {
  ETAPAS_CATALOGO,
  SLUGS_VALIDOS,
  buscarEtapaCatalogo,
};
