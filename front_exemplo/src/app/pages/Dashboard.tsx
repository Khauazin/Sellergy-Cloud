import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, ChevronDown, FileText, BarChart3, Calendar, Settings } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router";
import { GerenciarCategorias } from "../components/GerenciarCategorias";

interface Resumo {
  saldoAtual: number;
  receitas: { pagas: number; pendentes: number };
  despesas: { pagas: number; pendentes: number };
  atrasados: number;
}

type PeriodoType = "dia" | "mes" | "ano";

interface ChartData {
  periodo: string;
  valor: number;
}

export function Dashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [receitasDropdown, setReceitasDropdown] = useState(false);
  const [despesasDropdown, setDespesasDropdown] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoType>("mes");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [receitasChart, setReceitasChart] = useState<ChartData[]>([]);
  const [despesasChart, setDespesasChart] = useState<ChartData[]>([]);
  const [modalCategorias, setModalCategorias] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Mock data - substituir por chamada real à API
    setTimeout(() => {
      setResumo({
        saldoAtual: 15420.50,
        receitas: { pagas: 45300.00, pendentes: 12800.00 },
        despesas: { pagas: 29879.50, pendentes: 8500.00 },
        atrasados: 3,
      });
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    // Mock data para gráficos - substituir por chamada real à API
    const generateMockData = () => {
      if (periodo === "dia") {
        // Últimos 30 dias
        const receitas: ChartData[] = [];
        const despesas: ChartData[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dia = date.getDate().toString().padStart(2, "0");
          const mes = (date.getMonth() + 1).toString().padStart(2, "0");
          receitas.push({
            periodo: `${dia}/${mes}`,
            valor: Math.random() * 3000 + 500,
          });
          despesas.push({
            periodo: `${dia}/${mes}`,
            valor: Math.random() * 2500 + 300,
          });
        }
        setReceitasChart(receitas);
        setDespesasChart(despesas);
      } else if (periodo === "mes") {
        // Últimos 12 meses
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const receitas: ChartData[] = [];
        const despesas: ChartData[] = [];
        for (let i = 11; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const mesIndex = date.getMonth();
          receitas.push({
            periodo: meses[mesIndex],
            valor: Math.random() * 50000 + 10000,
          });
          despesas.push({
            periodo: meses[mesIndex],
            valor: Math.random() * 40000 + 8000,
          });
        }
        setReceitasChart(receitas);
        setDespesasChart(despesas);
      } else {
        // Últimos 5 anos
        const receitas: ChartData[] = [];
        const despesas: ChartData[] = [];
        const anoAtual = new Date().getFullYear();
        for (let i = 4; i >= 0; i--) {
          receitas.push({
            periodo: (anoAtual - i).toString(),
            valor: Math.random() * 500000 + 100000,
          });
          despesas.push({
            periodo: (anoAtual - i).toString(),
            valor: Math.random() * 400000 + 80000,
          });
        }
        setReceitasChart(receitas);
        setDespesasChart(despesas);
      }
    };

    generateMockData();
  }, [periodo, dataInicio, dataFim]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }


  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>
        <button
          onClick={() => setModalCategorias(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Settings size={18} />
          Gerenciar Categorias
        </button>
      </div>

      <GerenciarCategorias isOpen={modalCategorias} onClose={() => setModalCategorias(false)} />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Saldo Atual</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {resumo?.saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500 relative">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Receitas Pagas</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {resumo?.receitas.pagas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingUp className="text-blue-500" size={32} />
          </div>
          <button
            onClick={() => setReceitasDropdown(!receitasDropdown)}
            className="flex items-center justify-between w-full mt-3 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-sm text-blue-700 font-medium"
          >
            <span>Ver Relatórios</span>
            <ChevronDown size={16} className={`transition-transform ${receitasDropdown ? "rotate-180" : ""}`} />
          </button>

          {receitasDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setReceitasDropdown(false)} />
              <div className="absolute left-6 right-6 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                <button
                  onClick={() => navigate("/dashboard/receitas")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                >
                  <BarChart3 size={18} className="text-blue-600" />
                  <span className="text-sm text-gray-700 font-medium">Dashboard Receitas</span>
                </button>
                <button
                  onClick={() => navigate("/relatorio/receitas")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 transition-colors text-left border-t border-gray-100"
                >
                  <FileText size={18} className="text-blue-600" />
                  <span className="text-sm text-gray-700 font-medium">Relatório Analítico</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500 relative">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Despesas Pagas</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {resumo?.despesas.pagas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <TrendingDown className="text-orange-500" size={32} />
          </div>
          <button
            onClick={() => setDespesasDropdown(!despesasDropdown)}
            className="flex items-center justify-between w-full mt-3 px-3 py-2 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-sm text-orange-700 font-medium"
          >
            <span>Ver Relatórios</span>
            <ChevronDown size={16} className={`transition-transform ${despesasDropdown ? "rotate-180" : ""}`} />
          </button>

          {despesasDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDespesasDropdown(false)} />
              <div className="absolute left-6 right-6 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                <button
                  onClick={() => navigate("/dashboard/despesas")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-orange-50 transition-colors text-left"
                >
                  <BarChart3 size={18} className="text-orange-600" />
                  <span className="text-sm text-gray-700 font-medium">Dashboard Despesas</span>
                </button>
                <button
                  onClick={() => navigate("/relatorio/despesas")}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-orange-50 transition-colors text-left border-t border-gray-100"
                >
                  <FileText size={18} className="text-orange-600" />
                  <span className="text-sm text-gray-700 font-medium">Relatório Analítico</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Atrasados</p>
              <p className="text-2xl font-bold text-gray-900">{resumo?.atrasados}</p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </div>
      </div>

      {/* Filtros de Período */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-gray-600" size={20} />
          <h2 className="text-lg font-bold text-gray-900">Filtros de Período</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visualização
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="dia">Por Dia</option>
              <option value="mes">Por Mês</option>
              <option value="ano">Por Ano</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDataInicio("");
                setDataFim("");
              }}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Gráfico de Receitas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            Receitas por {periodo === "dia" ? "Dia" : periodo === "mes" ? "Mês" : "Ano"}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={receitasChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip
                formatter={(value: number) =>
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                }
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de Despesas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
            <TrendingDown size={24} className="text-orange-600" />
            Despesas por {periodo === "dia" ? "Dia" : periodo === "mes" ? "Mês" : "Ano"}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={despesasChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip
                formatter={(value: number) =>
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                }
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Resumo Pendente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-900 mb-3">Receitas Pendentes</h3>
          <p className="text-2xl text-blue-600 font-bold">
            R$ {resumo?.receitas.pendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-bold text-gray-900 mb-3">Despesas Pendentes</h3>
          <p className="text-2xl text-orange-600 font-bold">
            R$ {resumo?.despesas.pendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
