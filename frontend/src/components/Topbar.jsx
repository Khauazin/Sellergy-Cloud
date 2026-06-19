import { Menu, Search } from 'lucide-react';
import { IconButton } from './ui';
import UserMenu from './UserMenu';
import NotificacoesDropdown from './NotificacoesDropdown';

/**
 * Topbar premium. Recebe titulo da pagina e opcionalmente acoes a direita.
 */
export default function Topbar({ titulo, breadcrumb, actions, onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-[var(--bg-app)]/80 backdrop-blur-md border-b border-[var(--border-main)]">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onMenuClick && (
            <IconButton
              icon={Menu}
              variant="ghost"
              size="md"
              ariaLabel="Abrir menu"
              onClick={onMenuClick}
              className="lg:hidden"
            />
          )}
          <div className="min-w-0">
            {breadcrumb && (
              <div className="text-[11px] text-[var(--text-muted)] font-medium tracking-wide uppercase">
                {breadcrumb}
              </div>
            )}
            {titulo && (
              <h1 className="text-base sm:text-lg font-semibold text-[var(--text-main)] tracking-tight truncate leading-tight">
                {titulo}
              </h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {actions}
          <IconButton icon={Search} variant="ghost" size="md" ariaLabel="Buscar" />
          <NotificacoesDropdown />
          <div className="w-px h-6 bg-[var(--border-main)] mx-1" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
