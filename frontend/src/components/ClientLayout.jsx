import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import {
  LayoutDashboard,
  Bot,
  LogOut,
  Menu,
  Kanban,
  Calendar,
  DollarSign,
  Package,
  Box,
  Settings,
  Users,
  MoreHorizontal,
  ShoppingBag,
  ChevronDown,
  Sun,
  Moon,
  Search,
  Bell
} from 'lucide-react';
import clsx from 'clsx';

export default function ClientLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUiStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/app/login');
  };

  const navItems = [
    { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/app/vendas', label: 'Vendas', icon: ShoppingBag },
    { path: '/app/crm', label: 'CRM / Inbox', icon: Kanban },
    { path: '/app/agenda', label: 'Agenda', icon: Calendar },
    { path: '/app/catalogo', label: 'Catálogo', icon: Package },
    { path: '/app/estoque', label: 'Estoque', icon: Box },
    { path: '/app/financeiro', label: 'Financeiro', icon: DollarSign },
  ];

  const currentPageTitle = navItems.find(item => item.path === location.pathname)?.label || 
                           (location.pathname.includes('usuarios') ? 'Equipe' : 
                            location.pathname.includes('configuracoes') ? 'Configurações' : 'Dashboard');

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex overflow-hidden transition-colors duration-500">

      {/* Background Decorative Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-600/5 blur-[100px] pointer-events-none" />

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg-sidebar)] backdrop-blur-2xl border-r border-[var(--border-main)] transition-all duration-500 ease-in-out transform",
          !isSidebarOpen && "-translate-x-full shadow-none",
          isSidebarOpen && "shadow-[20px_0_50px_rgba(0,0,0,0.05)]"
        )}
      >
        <div className="h-24 flex items-center px-8 border-b border-[var(--border-main)]/50">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <Bot className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-[var(--text-main)] leading-none">BotManager</span>
              <span className="text-[10px] font-bold text-blue-500 tracking-[0.2em] uppercase mt-1">Enterprise</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          <div>
            <p className="px-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 opacity-50">Menu Principal</p>
            <nav className="space-y-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => clsx(
                    "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                    isActive
                      ? "text-[var(--text-main)] bg-white dark:bg-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[var(--border-main)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/50 dark:hover:bg-white/5"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={clsx(
                        "w-5 h-5 transition-all duration-300", 
                        isActive ? "text-blue-500 scale-110" : "group-hover:scale-110 group-hover:text-blue-400"
                      )} />
                      <span className={clsx("font-bold text-sm tracking-tight", isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100")}>{item.label}</span>
                      {isActive && (
                        <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <p className="px-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-4 opacity-50">Administração</p>
            <div className="space-y-1.5">
              <NavLink
                to="/app/usuarios"
                className={({ isActive }) => clsx(
                  "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                  isActive 
                    ? "text-[var(--text-main)] bg-white dark:bg-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[var(--border-main)]" 
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/50 dark:hover:bg-white/5"
                )}
              >
                <Users className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                <span className="text-sm font-bold tracking-tight">Equipe</span>
              </NavLink>
              <NavLink
                to="/app/configuracoes"
                className={({ isActive }) => clsx(
                  "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                  isActive 
                    ? "text-[var(--text-main)] bg-white dark:bg-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-[var(--border-main)]" 
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/50 dark:hover:bg-white/5"
                )}
              >
                <Settings className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                <span className="text-sm font-bold tracking-tight">Configurações</span>
              </NavLink>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border-main)]/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-4 py-4 rounded-2xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/5 transition-all duration-300 group active:scale-[0.98]"
          >
            <div className="p-2 rounded-xl bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
              <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </div>
            <span className="font-bold text-sm tracking-tight">Encerrar Sessão</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={clsx(
          "flex-1 flex flex-col min-h-screen transition-all duration-500 overflow-hidden relative",
          isSidebarOpen ? "ml-72" : "ml-0"
        )}
      >
        {/* Topbar */}
        <header className={clsx(
          "h-24 sticky top-0 z-40 px-8 flex items-center justify-between transition-all duration-300",
          scrolled ? "bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-[var(--border-main)] py-4 h-20" : "bg-transparent"
        )}>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:scale-105 transition-all shadow-sm active:scale-95"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col">
              <h2 className="text-2xl font-black text-[var(--text-main)] tracking-tighter uppercase italic leading-none">
                {currentPageTitle}
              </h2>
              <div className="flex items-center gap-2 mt-1 opacity-60">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Unidade Matriz</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Bar Placeholder */}
            <div className="hidden lg:flex items-center relative group">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-4 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                className="bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-2xl py-2.5 pl-11 pr-4 text-sm w-64 focus:w-80 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-[var(--text-muted)]/50 font-medium"
              />
            </div>

            <div className="h-8 w-[1px] bg-[var(--border-main)] mx-2 hidden md:block" />

            <div className="flex items-center gap-2">
              <button
                className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all shadow-sm relative group"
              >
                <Bell className="w-5 h-5 group-hover:shake" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--bg-app)]" />
              </button>

              <button
                onClick={toggleTheme}
                className="p-3 rounded-2xl bg-white dark:bg-white/5 border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all shadow-sm group"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                ) : (
                  <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform duration-500" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-4 pl-4 border-l border-[var(--border-main)] hidden sm:flex">
              <div className="flex flex-col items-end">
                <span className="text-sm font-black text-[var(--text-main)] tracking-tight uppercase leading-none">{user?.name}</span>
                <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Admin Account</span>
              </div>
              <div className="relative group cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-[2px] shadow-lg group-hover:scale-105 transition-transform">
                  <div className="w-full h-full rounded-[14px] bg-[var(--bg-app)] flex items-center justify-center overflow-hidden">
                    <span className="text-lg font-black text-[var(--text-main)]">{user?.name?.charAt(0)}</span>
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[var(--bg-app)]" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 relative overflow-y-auto custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

    </div>
  );
}
