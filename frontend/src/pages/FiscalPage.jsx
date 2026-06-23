import PlaceholderPage from './PlaceholderPage';

// CASCA pre-semeada pela Frente 1 (Fundacao). A Frente 3 substitui este
// conteudo pela tela real: configuracao fiscal (provedor + certificado +
// regime) e a lista de documentos emitidos (DocumentoFiscal) com status.
export default function FiscalPage() {
  return (
    <PlaceholderPage
      titulo="Fiscal"
      descricao="Configure a emissao de nota (NFC-e / NFS-e via provedor) e acompanhe os documentos emitidos. Em construcao."
      pacote="Pivo — Frente 3"
    />
  );
}
