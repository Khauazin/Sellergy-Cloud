import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import SellergyLogo from './SellergyLogo';

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
        // Desktop: 80px sempre (cabe icone com respiro), expande no hover para 320px
        'lg:w-20 lg:hover:w-80 lg:translate-x-0',
        // Mobile: drawer com 320px (mesma largura do expandido)
        'w-80',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Sombra quando expandida (hover ou mobile aberto)
        'lg:hover:shadow-[var(--shadow-md)]'
      )}
    >
      {/* Logo — branding do tenant (se houver) sobrepoe o default Sellergy */}
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-[var(--border-main)] flex-shrink-0">
        {branding?.logo ? (
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={branding.logo} alt={branding.nome || 'Logo'} className="w-full h-full object-cover" />
          </div>
        ) : (
          <SellergyLogo size={36} className="flex-shrink-0" />
        )}
        <div className="overflow-hidden flex-1 min-w-0 opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75">
          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight leading-tight whitespace-nowrap">
            {branding?.nome || 'Sellergy Cloud'}
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

function SidebarItem({ to, label, icon: Icon, badge, onClick, end = false, subItems }) {
  const location = useLocation();

  // Item com sub-itens: vira "menu pai" — clica no proprio parent leva pra `to`
  // se ele for navegavel, e os sub-itens ficam indentados visiveis quando o
  // sidebar esta expandido (hover ou mobile aberto).
  if (Array.isArray(subItems) && subItems.length > 0) {
    const algumSubAtivo = subItems.some((s) => location.pathname.startsWith(s.to));
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
              (isActive || algumSubAtivo)
                ? 'bg-[var(--primary)] text-[var(--text-on-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-main)]'
            )
          }
        >
          {({ isActive }) => (
            <>
              {(isActive || algumSubAtivo) && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--primary)]" />
              )}
              {Icon && (
                <Icon
                  size={18}
                  strokeWidth={1.75}
                  className={clsx(
                    'flex-shrink-0',
                    (isActive || algumSubAtivo) ? 'text-[var(--text-on-primary)]' : 'text-[var(--text-muted)] group-hover/item:text-[var(--text-secondary)]'
                  )}
                />
              )}
              <span className="flex-1 truncate opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap">
                {label}
              </span>
              <ChevronRight
                size={14}
                className={clsx(
                  'flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200',
                  'opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100 delay-75',
                  algumSubAtivo && 'rotate-90'
                )}
              />
            </>
          )}
        </NavLink>
        {/* Sub-itens — so visiveis QUANDO algum sub-item esta ativo (na rota).
            Se o user nao esta numa sub-rota, o dropdown fica fechado mesmo no hover. */}
        <ul
          className={clsx(
            'space-y-0.5 transition-all duration-200 overflow-hidden',
            algumSubAtivo
              ? 'mt-0.5 mb-1 opacity-100 max-h-96 lg:opacity-0 lg:max-h-0 lg:group-hover/sidebar:opacity-100 lg:group-hover/sidebar:max-h-96 lg:delay-100'
              : 'opacity-0 max-h-0'
          )}
        >
          {subItems.map((s) => (
            <SidebarSubItem key={s.to} {...s} onClick={onClick} />
          ))}
        </ul>
      </li>
    );
  }

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
              ? 'bg-[var(--primary)] text-[var(--text-on-primary)] font-semibold'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-main)]'
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--primary)]" />
            )}
            {Icon && (
              <Icon
                size={18}
                strokeWidth={1.75}
                className={clsx(
                  'flex-shrink-0',
                  isActive ? 'text-[var(--text-on-primary)]' : 'text-[var(--text-muted)] group-hover/item:text-[var(--text-secondary)]'
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
                  ? 'bg-[var(--text-on-primary)]/20 text-[var(--text-on-primary)]'
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

function SidebarSubItem({ to, label, onClick, end = false }) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        className={({ isActive }) =>
          clsx(
            'flex items-center h-8 pl-11 pr-3 rounded-lg',
            'text-[13px] font-medium tracking-tight',
            'transition-colors duration-150',
            isActive
              ? 'bg-[var(--bg-subtle)] text-[var(--text-main)] font-semibold'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-secondary)]'
          )
        }
      >
        <span className="truncate whitespace-nowrap">{label}</span>
      </NavLink>
    </li>
  );
}
