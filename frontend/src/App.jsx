import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import { useUiStore } from './store/ui.store';
import { ToastProvider } from './components/ui';

import LoginPage from './pages/LoginPage';
import ClientLoginPage from './pages/ClientLoginPage';
import LandingPage from './pages/LandingPage';
import TrocaSenhaPage from './pages/TrocaSenhaPage';

import AdminLayout from './components/AdminLayout';
import ClientLayout from './components/ClientLayout';

import DashboardPage from './pages/DashboardPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import DesignShowcasePage from './pages/DesignShowcasePage';
import PlaceholderPage from './pages/PlaceholderPage';

// Paginas reais do cliente (Pacote 3) - jaa rodando.
// Cliente
import CRMPage from './pages/CRMPage';
import AgendaPage from './pages/AgendaPage';
import VendasPage from './pages/VendasPage';
import CatalogoPage from './pages/CatalogoPage';
import EstoquePage from './pages/EstoquePage';
import FinanceiroPage from './pages/FinanceiroPage';
import CrmUsersPage from './pages/CrmUsersPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';
import PerfilPage from './pages/PerfilPage';
import CredenciaisPage from './pages/CredenciaisPage';

// Admin
import ClientsPage from './pages/ClientsPage';
import AdminPermissoesClientePage from './pages/AdminPermissoesClientePage';
import BotsPage from './pages/BotsPage';
import BotToolsPage from './pages/BotToolsPage';
import BotCanalPage from './pages/BotCanalPage';
import BuilderPage from './pages/BuilderPage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import ConfiguracoesAdminPage from './pages/ConfiguracoesAdminPage';

// Pacote 4 - placeholders.
const MensagensPlaceholder = () => <PlaceholderPage titulo="Mensagens" descricao="Inbox unificada estilo whatsapp web. Isolada por tenant." pacote="Pacote 4 — Novidades" />;
const CampanhasClientePlaceholder = () => <PlaceholderPage titulo="Campanhas" descricao="Disparos em massa via bot." pacote="Pacote 4 — Novidades" />;
const BotsClientePlaceholder = () => <PlaceholderPage titulo="Bots" descricao="Configurar IA do bot." pacote="Pacote 4 — Novidades" />;
const RelatoriosClientePlaceholder = () => <PlaceholderPage titulo="Relatorios" descricao="Em breve: dashboards consolidados." pacote="Pacote 3 — Cliente" />;

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
};

const TrocaSenhaGate = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (user?.deveTrocarSenha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }
  return children;
};

const AdminOnly = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.perfil !== 'ADMIN') return <Navigate to="/app/dashboard" replace />;
  return children;
};

const TenantOnly = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  if (user?.perfil === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return children;
};

export default function App() {
  const { checkAuth, isCheckingAuth } = useAuthStore();
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-app)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-[var(--border-strong)] border-t-[var(--text-main)] rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            Carregando
          </p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Publicas */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/admin/login" element={<LoginPage isAdmin />} />
          <Route path="/app/login" element={<ClientLoginPage />} />
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />

          {/* Troca de senha (autenticado, mas fora dos layouts) */}
          <Route
            path="/trocar-senha"
            element={
              <ProtectedRoute>
                <TrocaSenhaPage />
              </ProtectedRoute>
            }
          />

          {/* ECOSSISTEMA ADMIN */}
          <Route
            element={
              <ProtectedRoute>
                <TrocaSenhaGate>
                  <AdminOnly>
                    <AdminLayout />
                  </AdminOnly>
                </TrocaSenhaGate>
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/clientes" element={<ClientsPage />} />
            <Route path="/admin/clientes/permissoes" element={<AdminPermissoesClientePage />} />
            <Route path="/admin/clientes/:id" element={<ClientsPage />} />
            <Route path="/admin/bots" element={<BotsPage />} />
            <Route path="/admin/bots/:botId/tools" element={<BotToolsPage />} />
            <Route path="/admin/bots/:botId/canal" element={<BotCanalPage />} />
            <Route path="/admin/builder/:botId" element={<BuilderPage />} />
            <Route path="/admin/alertas" element={<AlertsPage />} />
            <Route path="/admin/relatorios" element={<ReportsPage />} />
            <Route path="/admin/usuarios" element={<UsersPage />} />
            <Route path="/admin/configuracoes" element={<ConfiguracoesAdminPage />} />
            <Route path="/admin/configuracoes/perfil" element={<PerfilPage />} />
            <Route path="/admin/_design" element={<DesignShowcasePage />} />
          </Route>

          {/* ECOSSISTEMA CLIENTE */}
          <Route
            element={
              <ProtectedRoute>
                <TrocaSenhaGate>
                  <TenantOnly>
                    <ClientLayout />
                  </TenantOnly>
                </TrocaSenhaGate>
              </ProtectedRoute>
            }
          >
            <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/app/dashboard" element={<ClientDashboardPage />} />
            <Route path="/app/crm" element={<CRMPage />} />
            <Route path="/app/agenda" element={<AgendaPage />} />
            <Route path="/app/vendas" element={<VendasPage />} />
            <Route path="/app/catalogo" element={<CatalogoPage />} />
            <Route path="/app/estoque" element={<EstoquePage />} />
            <Route path="/app/financeiro" element={<FinanceiroPage />} />
            <Route path="/app/mensagens" element={<MensagensPlaceholder />} />
            <Route path="/app/relatorios" element={<RelatoriosClientePlaceholder />} />
            <Route path="/app/bots" element={<BotsClientePlaceholder />} />
            <Route path="/app/campanhas" element={<CampanhasClientePlaceholder />} />
            <Route path="/app/usuarios" element={<CrmUsersPage />} />
            <Route path="/app/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/app/configuracoes/perfil" element={<PerfilPage />} />
            <Route path="/app/configuracoes/credenciais" element={<CredenciaisPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
