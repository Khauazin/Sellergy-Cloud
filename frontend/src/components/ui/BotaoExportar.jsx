// =====================================================================
// BotaoExportar — botão de exportação de relatório (3 formatos)
// =====================================================================
// Dropdown com CSV, Excel e PDF. Recebe uma função `montarDados` que
// retorna a estrutura comum esperada pelos helpers (ver utils/exportar.js).
// Construir os dados na hora do clique evita rerender desnecessário.
//
// O botão fica escondido em modo impressão (data-no-print) para não
// aparecer no PDF gerado.

import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { exportarCSV, exportarXLSX, exportarPDF } from '../../utils/exportar';

export default function BotaoExportar({ montarDados, desabilitado = false }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const acionar = (formato) => {
    setAberto(false);
    if (desabilitado) return;
    if (formato === 'pdf') {
      exportarPDF();
      return;
    }
    const dados = typeof montarDados === 'function' ? montarDados() : null;
    if (!dados) return;
    if (formato === 'csv') exportarCSV(dados);
    else if (formato === 'xlsx') exportarXLSX(dados);
  };

  return (
    <div ref={ref} className="relative inline-block" data-no-print>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={desabilitado}
        className={clsx(
          'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors',
          desabilitado
            ? 'border-[var(--border-main)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
            : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)]'
        )}
      >
        <Download size={14} strokeWidth={2} />
        Baixar relatório
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-56 bg-[var(--bg-elevated)] border border-[var(--border-main)] rounded-xl shadow-[var(--shadow-lg)] z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
          <ItemDropdown icone={FileText} titulo="CSV" descricao="Abre em qualquer planilha" onClick={() => acionar('csv')} />
          <ItemDropdown icone={FileSpreadsheet} titulo="Excel (.xlsx)" descricao="Formato Microsoft Excel" onClick={() => acionar('xlsx')} />
          <ItemDropdown icone={Printer} titulo="PDF" descricao="Imprime ou salva como PDF" onClick={() => acionar('pdf')} />
        </div>
      )}
    </div>
  );
}

function ItemDropdown({ icone: Icone, titulo, descricao, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-3.5 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors"
    >
      <Icone size={16} strokeWidth={1.75} className="text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)]">{titulo}</div>
        <div className="text-[11px] text-[var(--text-muted)]">{descricao}</div>
      </div>
    </button>
  );
}
