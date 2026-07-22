import { HelpCircle } from 'lucide-react';
import Tooltip from './Tooltip';

/**
 * Rotulo de campo com a explicacao escondida num icone de ajuda (?) logo ao
 * lado do texto. Mantem o formulario limpo: a dica aparece no tooltip, nao
 * embaixo do campo.
 *
 * Uso (passe na prop `label` de Input/Select/Textarea/InputDuracao e remova o `hint`):
 *   <Input label={<LabelAjuda texto="Preço" ajuda="O valor que o cliente paga." />} />
 */
export default function LabelAjuda({ texto, ajuda, position = 'top' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{texto}</span>
      {ajuda && (
        <Tooltip content={ajuda} position={position}>
          <HelpCircle
            size={15}
            strokeWidth={2}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-help"
          />
        </Tooltip>
      )}
    </span>
  );
}
