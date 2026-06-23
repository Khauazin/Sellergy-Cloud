// Gating por SEGMENTO do tenant — tipos de usuário e matriz módulos×ações.
//
// ⚠️ PROVISÓRIO (Frente 5 / rebuild ERP-first). Este arquivo é um CONTRATO
// LOCAL enquanto a Frente 1 não entrega o `backend/src/constants/modulosSegmento.js`
// generalizado (que vai gatear tipos + matriz por segmento — ver
// docs/orquestracao-6-claudes.md §Frente 1 e erp-arquitetura §2.5).
// No rebase em pivo/f2-fundacao: APAGAR este arquivo e re-apontar os imports
// (CrmUsuariosController) para o módulo oficial da Frente 1.
//
// NÃO confundir com `backend/src/utils/modulosSegmento.js` (dono: Frente 1),
// que só auto-ativa módulos no onboarding — aqui é sobre quem pode existir e
// o que pode ser concedido DENTRO de cada segmento.
//
// Regra de negócio (erp-arquitetura §2.5 / telas §13):
//   - Loja (PRODUTO):  Administrador, Vendedor/operador.            (sem Especialista)
//   - Clínica (SERVICO): Administrador, Especialista, Recepção.
//   - Híbrido (HIBRIDO): todos.
//   - Matriz: loja esconde módulos só-de-serviço (AGENDA); clínica esconde
//     módulos só-de-loja (ESTOQUE). VENDAS é compartilhado (serviço também
//     gera venda ao concluir atendimento).

// Tipos de usuário (conceito de UI/negócio). Mapeiam para Perfil + (Especialista):
//   ADMINISTRADOR -> perfil ADMINISTRADOR
//   VENDEDOR      -> perfil VENDEDOR (operador de loja)
//   RECEPCAO      -> perfil VENDEDOR + preset de recepção (persiste como VENDEDOR)
//   ESPECIALISTA  -> perfil VENDEDOR + registro Especialista (AGENDA-próprias)
const TIPOS_POR_SEGMENTO = {
  PRODUTO: ['ADMINISTRADOR', 'VENDEDOR'],
  SERVICO: ['ADMINISTRADOR', 'ESPECIALISTA', 'RECEPCAO'],
  HIBRIDO: ['ADMINISTRADOR', 'VENDEDOR', 'ESPECIALISTA', 'RECEPCAO'],
};

// Fallback permissivo: sem segmento definido, libera todos os tipos (tenant
// recém-criado sem segmento ainda consegue montar a equipe).
const TODOS_OS_TIPOS = ['ADMINISTRADOR', 'VENDEDOR', 'ESPECIALISTA', 'RECEPCAO'];

// Módulos concedíveis a um colaborador, por segmento. Espelha MODULOS_CRM do
// CrmUsuariosController; mantém em sync com frontend/src/constants/permissoes.js.
const MODULOS_COMPARTILHADOS = ['CRM', 'MENSAGENS', 'CATALOGO', 'FINANCEIRO', 'VENDAS', 'RELATORIOS', 'ALERTAS'];
const MODULOS_SO_SERVICO = ['AGENDA'];
const MODULOS_SO_LOJA = ['ESTOQUE'];

const MODULOS_POR_SEGMENTO = {
  PRODUTO: [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_LOJA],
  SERVICO: [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_SERVICO],
  HIBRIDO: [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_SERVICO, ...MODULOS_SO_LOJA],
};

const TODOS_OS_MODULOS = [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_SERVICO, ...MODULOS_SO_LOJA];

const norm = (segmento) => String(segmento || '').toUpperCase();

/** Tipos de usuário que podem ser criados num tenant deste segmento. */
function tiposPorSegmento(segmento) {
  return TIPOS_POR_SEGMENTO[norm(segmento)] || TODOS_OS_TIPOS;
}

/** IDs de módulos que podem ser concedidos a um colaborador deste segmento. */
function modulosPorSegmento(segmento) {
  return MODULOS_POR_SEGMENTO[norm(segmento)] || TODOS_OS_MODULOS;
}

/** Se este segmento aceita o tipo Especialista (clínica/serviço e híbrido). */
function segmentoPermiteEspecialista(segmento) {
  return tiposPorSegmento(segmento).includes('ESPECIALISTA');
}

module.exports = {
  tiposPorSegmento,
  modulosPorSegmento,
  segmentoPermiteEspecialista,
  TIPOS_POR_SEGMENTO,
  MODULOS_POR_SEGMENTO,
};
