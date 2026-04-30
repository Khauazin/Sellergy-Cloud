import { Construction, Sparkles } from 'lucide-react';
import { Card, Badge } from '../components/ui';

/**
 * Placeholder elegante para paginas que ainda serao reescritas.
 * Mantem rotas vivas durante a refatoracao em pacotes.
 */
export default function PlaceholderPage({ titulo, descricao, pacote }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Card padding="lg" className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center mb-5">
          <Construction size={22} className="text-[var(--accent)]" strokeWidth={1.75} />
        </div>

        {pacote && (
          <Badge variant="accent" size="sm" icon={Sparkles}>
            {pacote}
          </Badge>
        )}

        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-main)] mt-3">
          {titulo}
        </h2>

        <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
          {descricao || 'Esta tela esta sendo reescrita no design system v2 e fica pronta no proximo pacote.'}
        </p>

        <p className="text-xs text-[var(--text-muted)] mt-4">
          O backend ja esta funcional — apenas a interface ainda nao foi migrada.
        </p>
      </Card>
    </div>
  );
}
