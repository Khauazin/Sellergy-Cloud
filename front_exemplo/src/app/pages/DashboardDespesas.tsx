import { useEffect, useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft, Calendar, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router";

type PeriodoType = "dia" | "mes" | "ano";
type VisualizacaoType = "linha" | "barra" | "pizza";

interface ChartData {
  periodo: string;
  valor: number;
}

interface DespesaPorCategoria {
  nome: string;
  valor: number;
}

export function DashboardDespesas() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoType>("mes");
  const [visualizacao, setVisualizacao] = useState<VisualizacaoType>("linha");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [despesasPorCategoria, setDespesasPorCategoria] = useState<DespesaPorCategoria[]>([]);
  const [totalDespesas, setTotalDespesas] = useState(0);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      const generateData = () => {
        const data: ChartData[] = [];
        if (periodo === "dia") {
          for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            data.push({
              periodo: `${date.getDate()}/${date.getMonth() + 1}`,
              valor: Math.random() * 4000 + 800,
            });
          }
        } else if (periodo === "mes") {
          const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            data.push({
              periodo: meses[date.getMonth()],
              valor: Math.random() * 50000 + 15000,
            });
          }
        } else {
          for (let i = 4; i >= 0; i--) {
            const ano = new Date().getFullYear() - i;
            data.push({
              periodo: ano.toString(),
              valor: Math.random() * 500000 + 150000,
            });
          }
        }
        return data;
      };

      const data = generateData();
      setChartData(data);
      setTotalDespesas(data.reduce((sum, item) => sum + item.valor, 0));

      setDespesasPorCategoria([
        { nome: "Salários", valor: 35000 },
        { nome: "Aluguel", valor: 8000 },
        { nome: "Fornecedores", valor: 22000 },
        { nome: "Impostos", valor: 15000 },
        { nome: "Marketing", valor: 12000 },
      ]);

      setLoading(false);
    }, 500);
  }, [periodo, dataInicio, dataFim]);

  const COLORS = ["#f97316", "#ef4444", "#ec4899", "#a855f7", "#06b6d4"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft size={20} />
        <span>Voltar ao Dashboard</span>
      </button>

      <div className="flex items-center gap-3 mb-8">
        <TrendingDown className="text-orange-600" size={32} />
        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Despesas</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-gray-600" size={20} />
          <h2 className="text-lg font-bold text-gray-900">Filtros e Visualização</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as PeriodoType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="dia">Por Dia</option>
              <option value="mes">Por Mês</option>
              <option value="ano">Por Ano</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visualização</label>
            <select
              value={visualizacao}
              onChange={(e) => setVisualizacao(e.target.value as VisualizacaoType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="linha">Linha</option>
              <option value="barra">Barra</option>
              <option value="pizza">Pizza</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 mb-6 text-white">
        <p className="text-orange-100 mb-1">Total de Despesas no Período</p>
        <p className="text-4xl font-bold">
          R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Principal */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Despesas por {periodo === "dia" ? "Dia" : periodo === "mes" ? "Mês" : "Ano"}
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            {visualizacao === "linha" ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ fill: "#f97316", r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Despesas"
                />
              </LineChart>
            ) : visualizacao === "barra" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                />
                <Legend />
                <Bar dataKey="valor" fill="#f97316" name="Despesas" />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={chartData.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ periodo, percent }) => `${periodo}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="valor"
                >
                  {chartData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Despesas por Categoria */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Despesas por Categoria</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={despesasPorCategoria} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nome" type="category" width={100} />
              <Tooltip
                formatter={(value: number) =>
                  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                }
              />
              <Bar dataKey="valor" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
