import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Bot } from 'lucide-react';

/**
 * Sidebar do design system v2 com comportamento "hover-to-expand":
 *  - Em desktop: largura fixa de 64px (so icones). Ao passar o mouse expande para 256px com labels.
 *  - Em mobile: drawer tradicional via prop `mobileOpen`.
 */
export default function Sidebar({ sections = [], mobileOpen = false, onClose, footer, branding }) {
  return (
    <aside
      className={clsx(
        'group/sidebar fixed inset-y-0 left-0 z-40 flex flex-col',
        'bg-[var(--bg-sidebar)] border-r border-[var(--border-main)]',
        'overflow-hidden',
        'transition-[width,transform] duration-200 ease-out',
        // Desktop: w-16 sempre, expande no hover para w-64
        'lg:w-16 lg:hover:w-64 lg:translate-x-0',
        // Mobile: drawer com w-64
        'w-64',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Sombra quando expandida (hover ou mobile aberto)
        'lg:hover:shadow-[var(--shadow-md)]'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-[var(--border-main)] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
          {branding?.logo ? (
            <img src={branding.logo} alt={branding.nome || 'Logo'} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Bot size={16} className="text-[var(--text-on-primary)]" strokeWidth={2.25} />
          )}
        </div>
        <div className="overflow-hidden flex-1 min-w-0 opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75">
          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight leading-tight whitespace-nowrap">
            {branding?.nome || 'BotManager'}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider leading-tight whitespace-nowrap">
            Plataforma
          </div>
        </div>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 px-2">
        {sections.map((section, idx) => (
          <div key={idx} className={idx > 0 ? 'mt-5' : ''}>
            {section.titulo && (
              <div className="px-3 mb-1.5 h-4 overflow-hidden">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] whitespace-nowrap opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75">
                  {section.titulo}
                </div>
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarItem key={item.to} {...item} onClick={onClose} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer (opcional) */}
      {footer && (
        <div className="border-t border-[var(--border-main)] p-2 flex-shrink-0">
          {footer}
        </div>
      )}
    </aside>
  );
}

function SidebarItem({ to, label, icon: Icon, badge, onClick, end = false }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        title={label}
        className={({ isActive }) =>
          clsx(
            'group/item relative flex items-center gap-3 h-10 px-3 rounded-lg',
            'transition-colors duration-150',
            'text-sm font-medium tracking-tight',
            isActive
              ? 'bg-[var(--bg-subtle)] text-[var(--text-main)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-main)]'
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--accent)]" />
            )}
            {Icon && (
              <Icon
                size={18}
                strokeWidth={1.75}
                className={clsx(
                  'flex-shrink-0',
                  isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)] group-hover/item:text-[var(--text-secondary)]'
                )}
              />
            )}
            <span className="flex-1 truncate opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap">
              {label}
            </span>
            {badge != null && (
              <span className={clsx(
                'px-1.5 py-0.5 text-[10px] font-bold rounded-md flex-shrink-0',
                'opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75',
                isActive
                  ? 'bg-[var(--primary)] text-[var(--text-on-primary)]'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
              )}>
                {badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}
