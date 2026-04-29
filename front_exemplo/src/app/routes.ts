import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { RelatorioReceitas } from "./pages/RelatorioReceitas";
import { RelatorioDespesas } from "./pages/RelatorioDespesas";
import { DashboardReceitas } from "./pages/DashboardReceitas";
import { DashboardDespesas } from "./pages/DashboardDespesas";

export const router = createBrowserRouter([
  { path: "/", Component: Dashboard },
  { path: "/relatorio/receitas", Component: RelatorioReceitas },
  { path: "/relatorio/despesas", Component: RelatorioDespesas },
  { path: "/dashboard/receitas", Component: DashboardReceitas },
  { path: "/dashboard/despesas", Component: DashboardDespesas },
]);
