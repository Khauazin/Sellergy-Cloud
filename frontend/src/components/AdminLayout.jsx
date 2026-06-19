import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldCheck, Bot, Bell, BarChart3,
  Settings, Sparkles
} from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const SECTIONS = [
  {
    titulo: 'Geral',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    titulo: 'Clientes',
    items: [
      { to: '/admin/clientes', label: 'Lista de clientes', icon: Users },
      { to: '/admin/clientes/permissoes', label: 'Permissoes', icon: ShieldCheck },
    ],
  },
  {
    titulo: 'Operacao',
    items: [
      { to: '/admin/bots', label: 'Bots', icon: Bot },
      { to: '/admin/alertas', label: 'Alertas', icon: Bell },
      { to: '/admin/relatorios', label: 'Relatorios', icon: BarChart3 },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { to: '/admin/usuarios', label: 'Equipe', icon: Users },
      { to: '/admin/ia', label: 'Inteligencia (IA)', icon: Sparkles },
      { to: '/admin/configuracoes', label: 'Configuracoes', icon: Settings },
    ],
  },
];

const TITULOS = {
  '/admin/dashboard': { titulo: 'Visao geral', breadcrumb: 'Dashboard' },
  '/admin/clientes': { titulo: 'Clientes', breadcrumb: 'Gestao' },
  '/admin/clientes/permissoes': { titulo: 'Permissoes por cliente', breadcrumb: 'Gestao · Clientes' },
  '/admin/bots': { titulo: 'Bots', breadcrumb: 'Operacao' },
  '/admin/campanhas': { titulo: 'Campanhas', breadcrumb: 'Operacao' },
  '/admin/alertas': { titulo: 'Alertas', breadcrumb: 'Operacao' },
  '/admin/relatorios': { titulo: 'Relatorios', breadcrumb: 'Operacao' },
  '/admin/usuarios': { titulo: 'Equipe', breadcrumb: 'Sistema' },
  '/admin/ia': { titulo: 'Inteligencia Artificial', breadcrumb: 'Sistema' },
  '/admin/configuracoes': { titulo: 'Configuracoes', breadcrumb: 'Sistema' },
  '/admin/_design': { titulo: 'Design system', breadcrumb: 'Sistema' },
};

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const meta = TITULOS[location.pathname] || resolveDinamico(location.pathname);

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <Sidebar
        sections={SECTIONS}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--bg-overlay)] backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-20 min-h-screen flex flex-col">
        <Topbar
          titulo={meta.titulo}
          breadcrumb={meta.breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function resolveDinamico(path) {
  if (path.startsWith('/admin/clientes/')) return { titulo: 'Detalhes do cliente', breadcrumb: 'Clientes' };
  if (path.startsWith('/admin/builder/')) return { titulo: 'Construtor de fluxo', breadcrumb: 'Bots' };
  if (path.match(/^\/admin\/bots\/[^/]+\/tools$/)) return { titulo: 'Ferramentas do agente', breadcrumb: 'Bots' };
  if (path.match(/^\/admin\/bots\/[^/]+\/canal$/)) return { titulo: 'Canal do bot', breadcrumb: 'Bots' };
  return { titulo: 'Sellergy Cloud', breadcrumb: 'Admin' };
}
