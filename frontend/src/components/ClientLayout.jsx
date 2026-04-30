import { useState, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Kanban, Calendar, Package, Box,
  DollarSign, MessageCircle, Send, Bot, Settings, BarChart3
} from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuthStore } from '../store/auth.store';
import { moduloLiberado } from '../constants/permissoes';

// Mapeamento dos itens da sidebar para os modulos do tenant.
// Itens cujo modulo nao foi liberado pelo admin sao escondidos.
const NAV_TENANT = [
  { to: '/app/dashboard', label: 'Visao geral', icon: LayoutDashboard, modulo: null },
  { to: '/app/crm', label: 'CRM / Leads', icon: Kanban, modulo: 'CRM' },
  { to: '/app/mensagens', label: 'Mensagens', icon: MessageCircle, modulo: 'CRM' },
  { to: '/app/agenda', label: 'Agenda', icon: Calendar, modulo: 'AGENDA' },
  { to: '/app/vendas', label: 'Vendas', icon: ShoppingBag, modulo: 'VENDAS' },
  { to: '/app/catalogo', label: 'Catalogo', icon: Package, modulo: 'CATALOGO' },
  { to: '/app/estoque', label: 'Estoque', icon: Box, modulo: 'ESTOQUE' },
  { to: '/app/financeiro', label: 'Financeiro', icon: DollarSign, modulo: 'FINANCEIRO' },
  { to: '/app/relatorios', label: 'Relatorios', icon: BarChart3, modulo: 'RELATORIOS' },
];

const NAV_AUTOMACAO = [
  { to: '/app/bots', label: 'Bots', icon: Bot, modulo: 'BOTS' },
  { to: '/app/campanhas', label: 'Campanhas', icon: Send, modulo: 'BOTS' },
];

const TITULOS = {
  '/app/dashboard': { titulo: 'Visao geral', breadcrumb: 'Inicio' },
  '/app/crm': { titulo: 'CRM', breadcrumb: 'Vendas' },
  '/app/mensagens': { titulo: 'Mensagens', breadcrumb: 'Atendimento' },
  '/app/agenda': { titulo: 'Agenda', breadcrumb: 'Operacao' },
  '/app/vendas': { titulo: 'Vendas', breadcrumb: 'Operacao' },
  '/app/catalogo': { titulo: 'Catalogo', breadcrumb: 'Produtos' },
  '/app/estoque': { titulo: 'Estoque', breadcrumb: 'Produtos' },
  '/app/financeiro': { titulo: 'Financeiro', breadcrumb: 'Gestao' },
  '/app/relatorios': { titulo: 'Relatorios', breadcrumb: 'Gestao' },
  '/app/bots': { titulo: 'Bots', breadcrumb: 'Automacao' },
  '/app/campanhas': { titulo: 'Campanhas', breadcrumb: 'Automacao' },
  '/app/usuarios': { titulo: 'Equipe', breadcrumb: 'Conta' },
  '/app/configuracoes': { titulo: 'Configuracoes', breadcrumb: 'Conta' },
};

export default function ClientLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const modulosLiberados = user?.modulosLiberados || {};

  // Filtra os itens conforme os modulos liberados pelo admin para este tenant.
  const sections = useMemo(() => {
    const itensTenant = NAV_TENANT.filter((item) => !item.modulo || moduloLiberado(modulosLiberados, item.modulo));
    const itensAutomacao = NAV_AUTOMACAO.filter((item) => moduloLiberado(modulosLiberados, item.modulo));

    const result = [{ items: itensTenant }];
    if (itensAutomacao.length > 0) result.push({ titulo: 'Automacao', items: itensAutomacao });
    return result;
  }, [modulosLiberados]);

  const meta = TITULOS[location.pathname] || { titulo: 'BotManager', breadcrumb: '' };

  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      <Sidebar
        sections={sections}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        branding={user?.branding}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--bg-overlay)] backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-16 min-h-screen flex flex-col">
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
