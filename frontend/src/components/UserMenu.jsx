import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, Sun, Moon, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import { Avatar, Dropdown, DropdownItem, DropdownDivider, DropdownLabel } from './ui';

/**
 * Avatar + dropdown no canto superior direito.
 * Usado tanto pelo AdminLayout quanto pelo ClientLayout.
 */
export default function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUiStore();

  const handleLogout = () => {
    logout();
    navigate(user?.perfil === 'ADMIN' ? '/admin/login' : '/app/login');
  };

  const ehAdmin = user?.perfil === 'ADMIN';
  const rotaConfig = ehAdmin ? '/admin/configuracoes' : '/app/configuracoes';
  const rotaPerfil = ehAdmin ? '/admin/configuracoes/perfil' : '/app/configuracoes/perfil';

  const tagPerfil = {
    ADMIN: 'Administrador do sistema',
    CLIENT: 'Dono da conta',
    ADMINISTRADOR: 'Administrador',
    VENDEDOR: 'Vendedor',
  }[user?.perfil] || '';

  return (
    <Dropdown
      align="right"
      trigger={
        <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors">
          <Avatar name={user?.nome || user?.name} src={user?.foto} size="sm" />
          <div className="hidden md:block text-left">
            <div className="text-sm font-semibold text-[var(--text-main)] leading-tight tracking-tight">
              {user?.nome || user?.name || 'Usuario'}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] leading-tight">
              {tagPerfil}
            </div>
          </div>
          <ChevronDown size={14} className="text-[var(--text-muted)]" />
        </button>
      }
    >
      <DropdownLabel>{user?.email}</DropdownLabel>
      <DropdownItem icon={User} onClick={() => navigate(rotaPerfil)}>
        Meu perfil
      </DropdownItem>
      <DropdownItem icon={Settings} onClick={() => navigate(rotaConfig)}>
        Configuracoes
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem
        icon={theme === 'dark' ? Sun : Moon}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem icon={LogOut} variant="danger" onClick={handleLogout}>
        Sair
      </DropdownItem>
    </Dropdown>
  );
}
