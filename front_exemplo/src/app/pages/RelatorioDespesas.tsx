import { useEffect, useState } from "react";
import { ExportButton } from "../components/ExportButton";
import { Search, Filter, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
  categoria: { nome: string } | null;
}

export function RelatorioDespesas() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [filteredData, setFilteredData] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [categoriaFilter, setCategoriaFilter] = useState("TODAS");
  const navigate = useNavigate();

  useEffect(() => {
    // Mock data - substituir por chamada real à API
    setTimeout(() => {
      const mockData: Lancamento[] = [
        {
          id: "1",
          descricao: "Aluguel Escritório",
          valor: 3500.00,
          dataVencimento: "2026-04-10",
          dataPagamento: "2026-04-10",
          status: "PAGO",
          categoria: { nome: "Fixas" },
        },
        {
          id: "2",
          descricao: "Energia Elétrica",
          valor: 450.00,
          dataVencimento: "2026-04-15",
          dataPagamento: null,
          status: "PENDENTE",
          categoria: { nome: "Utilidades" },
        },
        {
          id: "3",
          descricao: "Fornecedor Materiais",
          valor: 1200.00,
          dataVencimento: "2026-04-20",
          dataPagamento: "2026-04-19",
          status: "PAGO",
          categoria: { nome: "Fornecedores" },
        },
        {
          id: "4",
          descricao: "Internet",
          valor: 250.00,
          dataVencimento: "2026-04-05",
          dataPagamento: null,
          status: "ATRASADO",
          categoria: { nome: "Utilidades" },
        },
        {
          id: "5",
          descricao: "Salários",
          valor: 15000.00,
          dataVencimento: "2026-04-30",
          dataPagamento: null,
          status: "PENDENTE",
          categoria: { nome: "Folha de Pagamento" },
        },
      ];
      setLancamentos(mockData);
      setFilteredData(mockData);
      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    let filtered = lancamentos;

    if (searchTerm) {
      filtered = filtered.filter((l) =>
        l.descricao.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "TODOS") {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }

    if (categoriaFilter !== "TODAS") {
      filtered = filtered.filter((l) => l.categoria?.nome === categoriaFilter);
    }

    setFilteredData(filtered);
  }, [searchTerm, statusFilter, categoriaFilter, lancamentos]);

  const totalDespesas = filteredData.reduce((sum, l) => sum + l.valor, 0);

  const exportData = filteredData.map((l) => ({
    Descrição: l.descricao,
    Valor: l.valor,
    Vencimento: l.dataVencimento,
    Pagamento: l.dataPagamento || "Não pago",
    Status: l.status,
    Categoria: l.categoria?.nome || "Sem categoria",
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          <span>Voltar ao Dashboard</span>
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Relatório Analítico - Despesas</h1>
          <ExportButton data={exportData} filename="relatorio-despesas" type="despesas" />
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="PAGO">Pago</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ATRASADO">Atrasado</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="TODAS">Todas as Categorias</option>
              <option value="Fixas">Fixas</option>
              <option value="Utilidades">Utilidades</option>
              <option value="Fornecedores">Fornecedores</option>
              <option value="Folha de Pagamento">Folha de Pagamento</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-orange-700">Total de Despesas ({filteredData.length} lançamentos)</p>
        <p className="text-2xl font-bold text-orange-900">
          R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Descrição</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Categoria</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vencimento</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pagamento</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.map((lancamento) => (
              <tr key={lancamento.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-900">{lancamento.descricao}</td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {lancamento.categoria?.nome || "—"}
                </td>
                <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                  R$ {lancamento.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(lancamento.dataVencimento).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {lancamento.dataPagamento
                    ? new Date(lancamento.dataPagamento).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      lancamento.status === "PAGO"
                        ? "bg-green-100 text-green-800"
                        : lancamento.status === "PENDENTE"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {lancamento.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhuma despesa encontrada
          </div>
        )}
      </div>
    </div>
  );
}
