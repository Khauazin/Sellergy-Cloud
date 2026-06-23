// Aplicacao do DTO normalizado do emissor no DocumentoFiscal local.
// Compartilhado pela emissao e pela sincronizacao de status — regra unica.

const prisma = require('../prisma');

// Campos seguros pra devolver (sem o payload bruto do emissor).
const CAMPOS_DOCUMENTO = {
  id: true, vendaId: true, tipo: true, status: true, provedor: true,
  provedorDocId: true, numero: true, chave: true, urlPdf: true, urlXml: true,
  mensagemErro: true, criadoEm: true, atualizadoEm: true,
};

// Estados terminais — uma vez EMITIDA/CANCELADA, nao volta atras.
const TERMINAIS = new Set(['EMITIDA', 'CANCELADA']);

// Aplica um DTO normalizado (emitir/consultarStatus) no documento. Nao
// "rebaixa" um documento ja terminal por um evento atrasado.
async function aplicarDocumento(doc, dto) {
  if (TERMINAIS.has(doc.status) && doc.status !== dto.status) {
    // Documento ja finalizado e o provedor mandou outro estado antigo -> ignora.
    return prisma.documentoFiscal.findUnique({ where: { id: doc.id }, select: CAMPOS_DOCUMENTO });
  }

  const data = {
    status: dto.status,
    provedorDocId: dto.provedorDocId || doc.provedorDocId,
    mensagemErro: dto.status === 'ERRO' ? (dto.mensagemErro || 'Falha na emissao.') : null,
  };
  if (dto.numero) data.numero = dto.numero;
  if (dto.chave) data.chave = dto.chave;
  if (dto.urlPdf) data.urlPdf = dto.urlPdf;
  if (dto.urlXml) data.urlXml = dto.urlXml;

  return prisma.documentoFiscal.update({ where: { id: doc.id }, data, select: CAMPOS_DOCUMENTO });
}

module.exports = { CAMPOS_DOCUMENTO, aplicarDocumento };
