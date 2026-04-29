import { useState, useEffect } from "react";
import { X, Plus, Trash2, Folder } from "lucide-react";

interface Categoria {
  id: string;
  nome: string;
  tipo: "RECEITA" | "DESPESA";
}

interface GerenciarCategoriasProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GerenciarCategorias({ isOpen, onClose }: GerenciarCategoriasProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState({ nome: "", tipo: "RECEITA" as "RECEITA" | "DESPESA" });

  useEffect(() => {
    if (isOpen) {
      carregarCategorias();
    }
  }, [isOpen]);

  const carregarCategorias = async () => {
    setLoading(true);
    // Mock data - substituir por chamada real à API: GET /api/financeiro/categorias
    setTimeout(() => {
      setCategorias([
        { id: "1", nome: "Vendas", tipo: "RECEITA" },
        { id: "2", nome: "Serviços", tipo: "RECEITA" },
        { id: "3", nome: "Aluguel", tipo: "DESPESA" },
        { id: "4", nome: "Salários", tipo: "DESPESA" },
      ]);
      setLoading(false);
    }, 300);
  };

  const criarCategoria = async () => {
    if (!novaCategoria.nome.trim()) {
      alert("Digite um nome para a categoria");
      return;
    }

    // Mock - substituir por: POST /api/financeiro/categorias
    const nova: Categoria = {
      id: Date.now().toString(),
      nome: novaCategoria.nome,
      tipo: novaCategoria.tipo,
    };

    setCategorias([...categorias, nova]);
    setNovaCategoria({ nome: "", tipo: "RECEITA" });
  };

  const excluirCategoria = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    // Mock - substituir por: DELETE /api/financeiro/categorias/:id
    setCategorias(categorias.filter((c) => c.id !== id));
  };

  const receitasCategorias = categorias.filter((c) => c.tipo === "RECEITA");
  const despesasCategorias = categorias.filter((c) => c.tipo === "DESPESA");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <Folder className="text-white" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-white">Categorias Financeiras</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Criar Nova Categoria */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl p-5 mb-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Adicionar Nova Categoria
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nome da categoria"
                value={novaCategoria.nome}
                onChange={(e) => setNovaCategoria({ ...novaCategoria, nome: e.target.value })}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                onKeyPress={(e) => e.key === "Enter" && criarCategoria()}
              />
              <select
                value={novaCategoria.tipo}
                onChange={(e) =>
                  setNovaCategoria({ ...novaCategoria, tipo: e.target.value as "RECEITA" | "DESPESA" })
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="RECEITA">💰 Receita</option>
                <option value="DESPESA">💸 Despesa</option>
              </select>
              <button
                onClick={criarCategoria}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
              >
                <Plus size={18} />
                <span className="font-semibold">Criar</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Categorias de Receitas */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border-2 border-emerald-100">
                <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 text-lg">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  💰 Receitas
                  <span className="ml-auto bg-emerald-200 text-emerald-800 px-3 py-1 rounded-full text-sm">
                    {receitasCategorias.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {receitasCategorias.map((cat) => (
                    <div
                      key={cat.id}
                      className="group flex items-center justify-between p-4 bg-white border-2 border-emerald-100 rounded-lg hover:border-emerald-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <Folder size={16} className="text-emerald-600" />
                        </div>
                        <span className="font-medium text-gray-900">{cat.nome}</span>
                      </div>
                      <button
                        onClick={() => excluirCategoria(cat.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {receitasCategorias.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Folder size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma categoria criada</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Categorias de Despesas */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border-2 border-orange-100">
                <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2 text-lg">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  💸 Despesas
                  <span className="ml-auto bg-orange-200 text-orange-800 px-3 py-1 rounded-full text-sm">
                    {despesasCategorias.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {despesasCategorias.map((cat) => (
                    <div
                      key={cat.id}
                      className="group flex items-center justify-between p-4 bg-white border-2 border-orange-100 rounded-lg hover:border-orange-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Folder size={16} className="text-orange-600" />
                        </div>
                        <span className="font-medium text-gray-900">{cat.nome}</span>
                      </div>
                      <button
                        onClick={() => excluirCategoria(cat.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {despesasCategorias.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Folder size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma categoria criada</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all font-semibold shadow-md hover:shadow-lg"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
