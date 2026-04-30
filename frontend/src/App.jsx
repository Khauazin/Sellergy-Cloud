import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import { useUiStore } from './store/ui.store';
import LoginPage from './pages/LoginPage';
import ClientLoginPage from './pages/ClientLoginPage';
import LandingPage from './pages/LandingPage';
import AdminLayout from './components/AdminLayout';
import ClientLayout from './components/ClientLayout';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import BotsPage from './pages/BotsPage';
import AlertsPage from './pages/AlertsPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import CRMPage from './pages/CRMPage';
import BuilderPage from './pages/BuilderPage';
import BotSettingsPage from './pages/BotSettingsPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
import AgendaPage from './pages/AgendaPage';
import FinanceiroPage from './pages/FinanceiroPage';
import CatalogoPage from './pages/CatalogoPage';
import EstoquePage from './pages/EstoquePage';
import CrmUsersPage from './pages/CrmUsersPage';
import VendasPage from './pages/VendasPage';
import TrocaSenhaPage from './pages/TrocaSenhaPage';
import AdminPermissoesClientePage from './pages/AdminPermissoesClientePage';
import clsx from 'clsx';

const EmConstrucao = ({ titulo }) => (
  <div className="h-full flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-12">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-2">{titulo}</h2>
      <p className="text-gray-400">Pagina em construcao... Estaremos trabalhando nisso ja ja!</p>
    </div>
  </div>
);

// Wrapper para rotas protegidas
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Forca usuario com deveTrocarSenha=true a passar pela tela de troca antes de qualquer coisa.
const TrocaSenhaGate = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (user?.deveTrocarSenha && location.pathname !== '/trocar-senha') {
    return <Navigate to="/trocar-senha" replace />;
  }
  return children;
};

// Wrapper para rotas estritas do Cliente
const ClientRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (user?.perfil === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return children;
};

// Wrapper para rotas estritas do Admin
const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  if (user?.perfil !== 'ADMIN') return <Navigate to="/app/dashboard" replace />;
  return children;
};

export default function App() {
  const { checkAuth, isCheckingAuth } = useAuthStore();
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  if (isCheckingAuth) {
    return (
      <div className={clsx("min-h-screen flex items-center justify-center transition-colors duration-300", theme === 'dark' ? "bg-[#0a0a0a]" : "bg-gray-50")}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("min-h-screen transition-colors duration-300", theme === 'dark' ? "dark bg-[#0a0a0a]" : "bg-gray-50")}>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/login" element={<LoginPage isAdmin={true} />} />
          <Route path="/app/login" element={<ClientLoginPage />} />
          <Route path="/" element={<LandingPage />} />

          {/* Redirecionamentos de conveniencia e legados */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
          <Route path="/builder/:botId" element={<Navigate to="/admin/builder/:botId" replace />} />

          {/* Rota de troca de senha forcada (acessivel mesmo com flag) */}
          <Route
            path="/trocar-senha"
            element={
              <ProtectedRoute>
                <TrocaSenhaPage />
              </ProtectedRoute>
            }
          />

          {/* Ecossistema ADMIN */}
          <Route
            element={
              <ProtectedRoute>
                <TrocaSenhaGate>
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                </TrocaSenhaGate>
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/clientes" element={<ClientsPage />} />
            <Route path="/admin/clientes/:id" element={<ClientProfilePage />} />
            <Route path="/admin/clientes/permissoes" element={<AdminPermissoesClientePage />} />
            <Route path="/admin/bots" element={<BotsPage />} />
            <Route path="/admin/alertas" element={<AlertsPage />} />
            <Route path="/admin/usuarios" element={<UsersPage />} />
            <Route path="/admin/relatorios" element={<ReportsPage />} />
            <Route path="/admin/builder/:botId" element={<BuilderPage />} />
          </Route>

          {/* Ecossistema CLIENT (CRM) */}
          <Route
            element={
              <ProtectedRoute>
                <TrocaSenhaGate>
                  <ClientRoute>
                    <ClientLayout />
                  </ClientRoute>
                </TrocaSenhaGate>
              </ProtectedRoute>
            }
          >
            <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />

            <Route path="/app/dashboard" element={<ClientDashboardPage />} />
            <Route path="/app/vendas" element={<VendasPage />} />
            <Route path="/app/crm" element={<CRMPage />} />
            <Route path="/app/agenda" element={<AgendaPage />} />
            <Route path="/app/catalogo" element={<CatalogoPage />} />
            <Route path="/app/estoque" element={<EstoquePage />} />
            <Route path="/app/financeiro" element={<FinanceiroPage />} />
            <Route path="/app/usuarios" element={<CrmUsersPage />} />
            <Route path="/app/configuracoes" element={<BotSettingsPage />} />
          </Route >
        </Routes >
      </BrowserRouter >
    </div>
  );
}
