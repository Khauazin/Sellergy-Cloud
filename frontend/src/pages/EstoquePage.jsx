import { useState, useEffect, useMemo } from 'react';
import { 
  Box, RefreshCcw, ArrowDownRight, ArrowUpRight, History, Search, Plus, 
  TrendingDown, DollarSign, AlertTriangle, PackageSearch, 
  ChevronLeft, ChevronRight, Loader2, Filter, Tag, PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';
import clsx from 'clsx';
import estoqueService from '../services/estoqueService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ModalMovimentarEstoque from '../components/Estoque/ModalMovimentarEstoque';
import ModalCategorias from '../components/Financeiro/ModalCategorias';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Cell, Pie, Legend
} from 'recharts';

const fmt = (val) =>
  Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const KpiCard = ({ label, value, loading, colorCls, icon: Icon, subLabel }) => (
  <div className="bg-white dark:bg-white/5 border border-[var(--border-main)] p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-amber-500/30 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-amber-500/5">
    <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.03] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
    
    <div className="flex justify-between items-start mb-6 relative z-10">
      <div className="flex flex-col gap-1">
        <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</p>
        {subLabel && <p className="text-[var(--text-muted)] text-[9px] font-bold uppercase opacity-40">{subLabel}</p>}
      </div>
      <div className={clsx("p-3.5 rounded-2xl bg-current opacity-10", colorCls)}>
         {Icon && <Icon className={clsx("w-5 h-5", colorCls)} style={{ opacity: 1 }} />}
      </div>
    </div>

    <div className="flex items-end gap-3 relative z-10">
      <h3 className={clsx('text-3xl font-black tracking-tighter transition-all duration-500 group-hover:translate-x-1', colorCls)}>
        {loading ? <span className="opacity-20 animate-pulse">...</span> : value}
      </h3>
    </div>
  </div>
);

export default function EstoquePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [reposicao, setReposicao] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let ignore = false;
    const carregar = async () => {
      try {
        setLoading(true);
        const [movs, dash, repo] = await Promise.all([
          estoqueService.listarMovimentacoes(),
          estoqueService.getDashboard(),
          estoqueService.getReposicao()
        ]);
        if (!ignore) {
          setMovimentacoes(movs);
          setDashboard(dash);
          setReposicao(repo);
        }
      } catch (err) {
        if (!ignore) console.error('Erro ao carregar estoque', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    carregar();
    return () => { ignore = true; };
  }, [refresh]);

  const filteredMovs = movimentacoes.filter(m => 
    m.variacao?.produto?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.motivo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pieData = useMemo(() => {
    if (!dashboard) return [];
    return [
      { name: 'Disponível', value: 100 - (dashboard.indiceRuptura || 0) },
      { name: 'Em Ruptura', value: dashboard.indiceRuptura || 0 }
    ];
  }, [dashboard]);

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">

      {/* Header Profissional */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-600 to-orange-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-amber-500/20 rotate-3 hover:rotate-0 transition-all duration-500 group">
            <Box className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-[var(--text-main)] tracking-tighter uppercase italic leading-none">Centro de Distribuição</h2>
            <div className="flex items-center gap-3 mt-1.5 opacity-60">
               <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
               <p className="text-[var(--text-muted)] text-[11px] font-black uppercase tracking-[0.3em]">Logística e Inventário em Tempo Real</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
          <button
            onClick={() => setIsCatModalOpen(true)}
            className="p-4 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] transition-all shadow-sm active:scale-95"
            title="Gerenciar Categorias"
          >
            <Tag className="w-6 h-6" />
          </button>
          <button
            onClick={() => setRefresh(r => r + 1)}
            className="p-4 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] transition-all shadow-sm active:scale-95"
          >
            <RefreshCcw className={clsx("w-6 h-6", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 lg:flex-none bg-black dark:bg-white text-white dark:text-black px-10 py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl hover:scale-[1.02] active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Nova Movimentação
          </button>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <KpiCard 
          label="Patrimônio Físico" 
          value={fmt(dashboard?.valorTotalInventario)} 
          loading={loading} 
          colorCls="text-blue-500" 
          icon={DollarSign} 
          subLabel="Total investido em produtos"
        />
        <KpiCard 
          label="Índice de Ruptura" 
          value={`${dashboard?.indiceRuptura || 0}%`} 
          loading={loading} 
          colorCls={(dashboard?.indiceRuptura || 0) > 5 ? "text-red-400" : "text-emerald-500"} 
          icon={TrendingDown} 
          subLabel="Produtos com estoque zerado"
        />
        <KpiCard 
          label="Reposição Urgente" 
          value={reposicao.length} 
          loading={loading} 
          colorCls="text-amber-400" 
          icon={AlertTriangle} 
          subLabel="Itens abaixo do mínimo"
        />
        <KpiCard 
          label="Auditoria de Log" 
          value={movimentacoes.length > 100 ? "99+" : movimentacoes.length} 
          loading={loading} 
          colorCls="text-purple-400" 
          icon={History} 
          subLabel="Registros identificados"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Saúde */}
        <div className="lg:col-span-1 space-y-8">
           <div className="bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-[2.5rem] p-10 shadow-sm relative group overflow-hidden">
              <div className="mb-10 text-center relative z-10">
                <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Saúde do Inventário</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1 opacity-60">Disponibilidade de SKU</p>
              </div>

              <div className="h-[300px] w-full relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-[10px] font-black uppercase text-[var(--text-muted)] opacity-50">SKUs Ativos</span>
                   <span className="text-3xl font-black text-[var(--text-main)]">{dashboard?.totalProdutos || 0}</span>
                </div>
              </div>

              <div className="mt-8 space-y-4 relative z-10">
                <div className="flex justify-between items-center p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Itens Disponíveis</span>
                  </div>
                  <span className="text-sm font-black text-emerald-500">{100 - (dashboard?.indiceRuptura || 0)}%</span>
                </div>
                <div className="flex justify-between items-center p-5 bg-red-500/5 rounded-2xl border border-red-500/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[10px] font-black uppercase text-[var(--text-muted)]">Em Ruptura</span>
                  </div>
                  <span className="text-sm font-black text-red-500">{dashboard?.indiceRuptura || 0}%</span>
                </div>
              </div>
           </div>

           <div className="bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="p-8 border-b border-[var(--border-main)] bg-gray-50/50 dark:bg-black/20 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-6 bg-amber-500 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)]" />
                   <h3 className="text-[var(--text-main)] text-[11px] font-black uppercase tracking-[0.2em]">Reposição Sugerida</h3>
                </div>
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[9px] px-3 py-1 rounded-full border border-amber-200 dark:border-amber-500/20 font-black uppercase tracking-widest shadow-sm">
                  {reposicao.length} ALERTAS
                </span>
              </div>
              <div className="p-8 space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar">
                {reposicao.length === 0 ? (
                  <div className="py-24 text-center flex flex-col items-center">
                     <div className="w-20 h-20 bg-emerald-500/5 rounded-full flex items-center justify-center mb-6">
                        <PackageSearch className="w-10 h-10 text-emerald-500 opacity-20" />
                     </div>
                     <p className="text-gray-500 dark:text-gray-600 text-[11px] font-black uppercase tracking-widest italic opacity-50">Logística em conformidade</p>
                  </div>
                ) : (
                  reposicao.map(item => (
                    <div key={item.id} className="p-5 bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl group hover:border-amber-500/30 transition-all hover:translate-x-1 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-[var(--text-main)] font-black uppercase tracking-tight italic group-hover:text-amber-600 transition-colors">{item.produto}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase mt-1 opacity-60 tracking-widest">{item.variacao}</p>
                        </div>
                        <span className={clsx(
                          "text-[9px] px-2 py-1 rounded-lg font-black tracking-widest shadow-sm",
                          item.urgencia === 'ALTA' ? "bg-red-500 text-white" : "bg-amber-500 text-black"
                        )}>
                          {item.urgencia}
                        </span>
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t border-[var(--border-main)]/50 pt-4">
                         <div className="flex gap-6">
                            <div className="flex flex-col">
                              <p className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter opacity-50 text-center">Atual</p>
                              <p className="text-sm font-black text-[var(--text-main)] text-center">{item.estoqueAtual}</p>
                            </div>
                            <div className="flex flex-col">
                              <p className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-tighter opacity-50 text-center">Ideal</p>
                              <p className="text-sm font-black text-gray-400 dark:text-gray-500 text-center">{item.estoqueIdeal}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] text-amber-600 dark:text-amber-500 uppercase font-black tracking-widest leading-none">Necessidade</p>
                            <p className="text-2xl font-black text-amber-600 dark:text-amber-500 tracking-tighter mt-1">+{item.necessidade}</p>
                         </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
           </div>
        </div>

        {/* Histórico de Movimentações */}
        <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-[2.5rem] flex flex-col overflow-hidden shadow-sm">
          <div className="p-8 border-b border-[var(--border-main)] flex flex-col lg:flex-row gap-6 items-center bg-gray-50/50 dark:bg-black/20">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Localizar movimentação no histórico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-black/40 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-4 pl-14 pr-6 text-sm focus:outline-none focus:border-amber-500 transition-all placeholder:text-gray-400 font-medium shadow-sm"
              />
            </div>
            <button className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] text-[11px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
              <Filter className="w-4 h-4" /> Filtrar Lista
            </button>
          </div>

          <div className="overflow-x-auto min-h-[600px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-40">
                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-6" />
                <p className="text-[var(--text-muted)] text-[11px] font-black uppercase tracking-[0.3em]">Auditoria do banco...</p>
              </div>
            ) : filteredMovs.length === 0 ? (
              <div className="p-40 text-center text-gray-400 dark:text-gray-600 italic font-medium uppercase tracking-widest opacity-50">
                Nenhum registro de movimentação encontrado.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-black/40 text-[var(--text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">
                    <th className="p-8">Data & Hora</th>
                    <th className="p-8">Produto / Variação</th>
                    <th className="p-8 text-center">Operação</th>
                    <th className="p-8">Motivo / Justificativa</th>
                    <th className="p-8 text-right">Qtd</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-[var(--border-main)]/50">
                  {filteredMovs.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all group">
                      <td className="p-8 whitespace-nowrap">
                        <div className="text-[var(--text-main)] font-black text-sm tracking-tight">{format(new Date(m.data), 'dd/MM/yyyy')}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase mt-1 opacity-50">{format(new Date(m.data), 'HH:mm')}</div>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col">
                          <span className="text-[var(--text-main)] font-black text-sm tracking-tight italic uppercase opacity-90 group-hover:text-amber-600 transition-colors">{m.variacao?.produto?.nome}</span>
                          <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1 opacity-60">{m.variacao?.nome}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex justify-center">
                           <span className={clsx(
                            "text-[9px] font-black px-3 py-1.5 rounded-full border uppercase tracking-[0.1em] shadow-sm",
                            m.tipo === 'VENDA' || m.tipo === 'RESERVA' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" :
                              m.tipo === 'COMPRA_FORNECEDOR' || m.tipo === 'DEVOLUCAO' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" :
                                "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                          )}>
                            {m.tipo}
                          </span>
                        </div>
                      </td>
                      <td className="p-8 text-[var(--text-muted)] text-xs font-bold max-w-xs truncate italic opacity-80">
                        {m.motivo || 'Ajuste Automático'}
                      </td>
                      <td className={clsx(
                        "p-8 text-right font-black whitespace-nowrap text-xl tracking-tighter",
                        m.quantidade > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}>
                        <div className="flex items-center justify-end gap-2">
                          {m.quantidade > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          {Math.abs(m.quantidade)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-8 border-t border-[var(--border-main)] bg-gray-50/50 dark:bg-black/40 flex items-center justify-between">
             <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-[0.3em] opacity-50">Sincronização de logs completa</p>
             <div className="flex gap-4">
                <button className="p-4 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-[var(--border-main)] rounded-2xl disabled:opacity-20 transition-all shadow-sm active:scale-95">
                   <ChevronLeft className="w-5 h-5 text-[var(--text-main)]" />
                </button>
                <button className="p-4 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-[var(--border-main)] rounded-2xl disabled:opacity-20 transition-all shadow-sm active:scale-95">
                   <ChevronRight className="w-5 h-5 text-[var(--text-main)]" />
                </button>
             </div>
          </div>
        </div>
      </div>

      <ModalMovimentarEstoque
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => setRefresh(r => r + 1)}
      />
      
      <ModalCategorias 
        isOpen={isCatModalOpen} 
        onClose={() => setIsCatModalOpen(false)} 
      />
    </div>
  );
}
