import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, Plus, Search, RefreshCcw, Tag, 
  MoreVertical, Edit, Trash2, Box, 
  Layers, AlertCircle, DollarSign,
  ArrowUpRight, Loader2, Filter
} from 'lucide-react';
import clsx from 'clsx';
import catalogoService from '../services/catalogoService';
import ModalNovoProduto from '../components/Catalogo/ModalNovoProduto';
import ModalCategorias from '../components/Financeiro/ModalCategorias';

const fmt = (val) =>
  Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const KpiCard = ({ label, value, loading, colorCls, icon: Icon, subLabel }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-[2rem] relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 shadow-sm">
    <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
    
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className="flex flex-col gap-0.5">
        <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{label}</p>
        {subLabel && <p className="text-gray-400 dark:text-gray-600 text-[9px] font-bold uppercase">{subLabel}</p>}
      </div>
      <div className={clsx("p-2 rounded-xl bg-current opacity-10", colorCls)}>
         {Icon && <Icon className={clsx("w-4 h-4", colorCls)} style={{ opacity: 1 }} />}
      </div>
    </div>

    <div className="flex items-end gap-3 relative z-10">
      <h3 className={clsx('text-3xl font-black tracking-tighter transition-all duration-500 group-hover:translate-x-1', colorCls)}>
        {loading ? <span className="opacity-20 animate-pulse">...</span> : value}
      </h3>
    </div>
  </div>
);

export default function CatalogoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await catalogoService.listar();
      setProdutos(data);
    } catch {
      console.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const stats = useMemo(() => {
    let patrimonio = 0;
    let zerados = 0;
    let totalItens = 0;

    produtos.forEach(p => {
      p.variacoes?.forEach(v => {
        totalItens++;
        patrimonio += (v.estoqueAtual || 0) * (v.preco || 0);
        if (p.tipo === 'FISICO' && (v.estoqueAtual || 0) <= 0) zerados++;
      });
    });

    return { patrimonio, zerados, totalItens, totalProdutos: produtos.length };
  }, [produtos]);

  const filteredProdutos = produtos.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.categoria?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-in fade-in duration-700">

      {/* Header Profissional */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-tr from-purple-600 to-blue-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">Mestre de Produtos</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
               <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em]">Gestão de Acervo e Classificação</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="p-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] transition-all shadow-sm"
            title="Gerenciar Categorias"
          >
            <Tag className="w-5 h-5" />
          </button>
          <button
            onClick={carregarProdutos}
            className="p-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] transition-all shadow-sm"
          >
            <RefreshCcw className={clsx("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 lg:flex-none bg-purple-600 dark:bg-white text-white dark:text-black px-8 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-500/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-5 h-5" /> Novo Registro
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          label="Valor de Mercado" 
          value={fmt(stats.patrimonio)} 
          loading={loading} 
          colorCls="text-blue-500" 
          icon={DollarSign} 
          subLabel="Total em estoque (venda)"
        />
        <KpiCard 
          label="Total de Unidades" 
          value={stats.totalItens} 
          loading={loading} 
          colorCls="text-purple-500" 
          icon={Layers} 
          subLabel="Itens cadastrados"
        />
        <KpiCard 
          label="Ruptura de Estoque" 
          value={stats.zerados} 
          loading={loading} 
          colorCls="text-red-500" 
          icon={AlertCircle} 
          subLabel="Itens sem saldo disponível"
        />
        <KpiCard 
          label="Mix de Produtos" 
          value={stats.totalProdutos} 
          loading={loading} 
          colorCls="text-amber-500" 
          icon={Box} 
          subLabel="Modelos únicos"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-2 rounded-2xl flex flex-col md:flex-row items-center gap-3 backdrop-blur-sm shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filtrar por nome, descrição ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-black/40 border border-[var(--border-main)] text-[var(--text-main)] rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm transition-all placeholder:text-gray-400 shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-xl border border-[var(--border-main)] text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
          <Filter className="w-3.5 h-3.5" /> Filtrar Mix
        </button>
      </div>

      {/* Grid de Produtos Premium */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-32">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
          <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em]">Consultando Acervo...</p>
        </div>
      ) : filteredProdutos.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-dashed border-[var(--border-main)] rounded-[3rem] p-20 text-center shadow-sm">
          <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-gray-400 dark:text-gray-700" />
          </div>
          <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Nenhum item localizado</h3>
          <p className="text-[var(--text-muted)] mt-2 max-w-sm mx-auto text-sm font-medium">
            Sua busca não retornou resultados ou seu catálogo ainda está vazio. Comece a construir seu inventário agora.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-8 text-purple-600 dark:text-purple-400 hover:underline text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Cadastrar novo produto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredProdutos.map(produto => (
            <div key={produto.id} className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2.5rem] p-8 hover:border-purple-500/30 transition-all group relative overflow-hidden shadow-sm hover:shadow-lg dark:hover:shadow-purple-500/5">
              <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500 opacity-[0.03] rounded-full -mr-20 -mt-20 blur-3xl group-hover:opacity-10 transition-opacity" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex flex-col gap-2">
                   <div className={clsx(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm w-fit",
                    produto.tipo === 'FISICO' ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20"
                  )}>
                    {produto.tipo === 'FISICO' ? 'Físico' : 'Serviço'}
                  </div>
                  {produto.categoria && (
                    <span className="text-[8px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest px-2 py-0.5 bg-purple-500/5 rounded border border-purple-500/10 shadow-sm w-fit">
                      {produto.categoria.nome}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                   <button className="p-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all shadow-sm">
                      <Edit className="w-4 h-4" />
                   </button>
                   <button className="p-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all shadow-sm">
                      <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <h4 className="text-2xl font-black text-[var(--text-main)] mb-2 tracking-tighter group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors italic">{produto.nome}</h4>
              <p className="text-[var(--text-muted)] text-sm line-clamp-2 mb-8 h-10 font-medium leading-relaxed opacity-80">{produto.descricao || 'Sem descrição detalhada disponível.'}</p>

              <div className="space-y-3 relative z-10">
                {produto.variacoes?.map(v => (
                  <div key={v.id} className="flex items-center justify-between bg-gray-50 dark:bg-black/40 rounded-[1.25rem] p-4 border border-[var(--border-main)] group/v transition-all hover:border-purple-500/20 hover:translate-x-1 shadow-sm">
                    <div className="flex flex-col">
                      <p className="text-xs font-black text-[var(--text-main)] uppercase tracking-tight">{v.nome}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase">SKU: {v.sku || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{fmt(v.preco)}</p>
                      <p className={clsx(
                        "text-[9px] font-black uppercase tracking-widest",
                        v.estoqueAtual <= (v.estoqueMinimo || 0) ? "text-red-500" : "text-gray-500"
                      )}>
                        {produto.tipo === 'FISICO' ? `${v.estoqueAtual} Unid.` : 'ILIMITADO'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-[var(--border-main)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  <Tag className="w-3 h-3 text-purple-500/50" />
                  {produto.visibilidade}
                </div>
                <button className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest hover:underline transition-colors flex items-center gap-1">
                  Ver Detalhes <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalNovoProduto
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={carregarProdutos}
      />

      <ModalCategorias 
        isOpen={isCatModalOpen} 
        onClose={() => setIsCatModalOpen(false)} 
      />
    </div>
  );
}
