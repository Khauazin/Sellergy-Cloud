// =====================================================================
// FiltroRapido — botões orientados a decisão de negócio (estilo neutro)
// =====================================================================
// Em vez de o usuário compor "data=ontem + status=PENDENTE + tipo=RECEITA"
// para responder "o que entrou ontem?", oferecemos um botão que já aplica
// essa combinação. Cada filtro rápido é uma pergunta de negócio.
//
// Visual neutro (preto/cinza apenas) — sem semáforo verde/vermelho que
// poluem o cabeçalho. A diferenciação fica clara pelo TEXTO da pergunta,
// não pela cor.
//
// Uso:
//   <FiltroRapido
//     ativo={chave}
//     opcoes={[
//       { chave: 'recebidos-mes', label: 'Recebidos no mês', icone: TrendingUp },
//       { chave: 'atrasados-30', label: 'Atrasados +30 dias', icone: AlertCircle },
//     ]}
//     onChange={(chave) => aplicar(chave)}
//   />

import clsx from 'clsx';

const INATIVO = 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--text-muted)] hover:text-[var(--text-main)]';
const ATIVO = 'bg-[var(--primary)] text-[var(--text-on-primary)] border-[var(--primary)]';

export default function FiltroRapido({ ativo, opcoes = [], onChange }) {
  if (!opcoes || opcoes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1">
        Filtros rápidos
      </div>
      {opcoes.map((o) => {
        const Icone = o.icone;
        const ehAtivo = ativo === o.chave;
        return (
          <button
            key={o.chave}
            type="button"
            onClick={() => onChange?.(ehAtivo ? null : o.chave)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              ehAtivo ? ATIVO : INATIVO
            )}
          >
            {Icone && <Icone size={12} strokeWidth={2} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
