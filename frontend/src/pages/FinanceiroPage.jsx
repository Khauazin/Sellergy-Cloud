import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, ArrowUpRight, ArrowDownRight,
  Plus, Search, RefreshCcw, ChevronLeft, ChevronRight, X, Tag,
  BarChart3, List, Wallet, TrendingUp, AlertCircle, Filter, Loader2,
  Calendar, MoreVertical, Edit, Trash2, CheckCircle2, Clock, PieChart as PieChartIcon
} from 'lucide-react';
import api from '../services/api';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';
import ModalNovoLancamento from '../components/Financeiro/ModalNovoLancamento';
import ModalCategorias from '../components/Financeiro/ModalCategorias';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Legend, PieChart, Cell, Pie 
} from 'recharts';

const fmt = (val) =>
  Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const KpiCard = ({ label, value, loading, colorCls, icon: Icon, subLabel, trend }) => (
  <div className="bg-white dark:bg-white/5 border border-[var(--border-main)] p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-blue-500/5">
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

    <div className="flex items-end justify-between relative z-10">
      <h3 className={clsx('text-3xl font-black tracking-tighter transition-all duration-500 group-hover:translate-x-1', colorCls)}>
        {loading ? <span className="opacity-20 animate-pulse">...</span> : value}
      </h3>
      {trend && !loading && (
        <div className={clsx("flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-full bg-current opacity-10", colorCls)}>
           {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
           {Math.abs(trend)}%
        </div>
      )}
    </div>
  </div>
);

export default function FinanceiroPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [lancamentos, setLancamentos] = useState([]);
  const [resumo, setResumo] = useState({ entradas: 0, saidas: 0, saldo: 0 });
  const [dashboardData, setDashboardData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [resResumo, resLancamentos, resDash] = await Promise.all([
        api.get('/financeiro/resumo'),
        api.get('/financeiro/lancamentos?limite=100'),
        api.get('/financeiro/dashboard')
      ]);
      setResumo(resResumo.data);
      setLancamentos(resLancamentos.data.dados || []);
      setDashboardData(resDash.data);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const stats = useMemo(() => {
    if (!dashboardData) return null;
    return {
      receita: dashboardData.resumo.receita,
      despesa: dashboardData.resumo.despesa,
      saldo: dashboardData.resumo.saldo,
      emRisco: dashboardData.kpis.saldoEmRisco,
      eficacia: dashboardData.kpis.indiceEficacia
    };
  }, [dashboardData]);

  const chartData = useMemo(() => {
    if (!lancamentos.length) return [];
    
    // Agrupar por data para o gráfico de fluxo
    const group = lancamentos.reduce((acc, l) => {
      const date = format(parseISO(l.dataVencimento), 'dd/MM');
      if (!acc[date]) acc[date] = { date, receita: 0, despesa: 0 };
      if (l.tipo === 'RECEITA') acc[date].receita += l.valor;
      else acc[date].despesa += l.valor;
      return acc;
    }, {});

    return Object.values(group).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  }, [lancamentos]);

  const filteredLancamentos = lancamentos.filter(l => 
    l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-20 animate-in fade-in duration-700">

      {/* Header Estilo High-End */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 rotate-3 hover:rotate-0 transition-all duration-500 group">
            <Wallet className="w-10 h-10 text-white group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">Tesouraria Digital</h2>
            <div className="flex items-center gap-3 mt-1.5">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-[var(--text-muted)] text-[11px] font-black uppercase tracking-[0.3em] opacity-70">Gestão de Fluxo e Patrimônio</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto">
           <button
            onClick={() => setIsCatModalOpen(true)}
            className="p-4 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] transition-all shadow-sm active:scale-95"
          >
            <Tag className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 lg:flex-none bg-black dark:bg-white text-white dark:text-black px-10 py-4 rounded-2xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl hover:scale-[1.02] active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* KPIs Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <KpiCard 
          label="Faturamento Real" 
          value={fmt(stats?.receita)} 
          loading={loading} 
          colorCls="text-emerald-500" 
          icon={TrendingUp} 
          subLabel="Entradas confirmadas"
          trend={12}
        />
        <KpiCard 
          label="Custo Operacional" 
          value={fmt(stats?.despesa)} 
          loading={loading} 
          colorCls="text-red-500" 
          icon={ArrowDownRight} 
          subLabel="Despesas pagas"
        />
        <KpiCard 
          label="Saldo em Risco" 
          value={fmt(stats?.emRisco)} 
          loading={loading} 
          colorCls="text-amber-500" 
          icon={AlertCircle} 
          subLabel="Vencidos não pagos"
        />
        <KpiCard 
          label="Eficiência de Cobrança" 
          value={`${stats?.eficacia || 0}%`} 
          loading={loading} 
          colorCls="text-blue-500" 
          icon={CheckCircle2} 
          subLabel="Taxa de recuperação"
        />
      </div>

      {/* Tabs Customizadas */}
      <div className="flex gap-2 p-2 bg-white dark:bg-white/5 rounded-[1.5rem] w-fit border border-[var(--border-main)] shadow-sm">
         <button 
           onClick={() => setActiveTab('dashboard')}
           className={clsx(
             "px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
             activeTab === 'dashboard' ? "bg-black dark:bg-white text-white dark:text-black shadow-lg" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
           )}
         >
           Performance
         </button>
         <button 
           onClick={() => setActiveTab('lancamentos')}
           className={clsx(
             "px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
             activeTab === 'lancamentos' ? "bg-black dark:bg-white text-white dark:text-black shadow-lg" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
           )}
         >
           Livro Razão
         </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
           
           <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-[2.5rem] p-10 shadow-sm overflow-hidden relative group">
              <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Fluxo de Caixa (15 dias)</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1 opacity-60">Movimentação diária de entradas e saídas</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-[var(--text-muted)]">Receitas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-[9px] font-black uppercase text-[var(--text-muted)]">Despesas</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: 'var(--text-muted)' }} 
                      dy={10}
                    />
                    <YAxis 
                      hide
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-app)', 
                        border: '1px solid var(--border-main)',
                        borderRadius: '1rem',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase'
                      }} 
                    />
                    <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
                    <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesa)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-[2.5rem] p-10 shadow-sm">
              <div className="mb-10 text-center">
                <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Composição Financeira</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1 opacity-60">Distribuição de Status</p>
              </div>

              <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pago', value: stats?.receita || 1 },
                        { name: 'Em Risco', value: stats?.emRisco || 0 }
                      ]}
                      innerRadius={80}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                   <span className="text-[10px] font-black uppercase text-[var(--text-muted)] opacity-50">Saldo</span>
                   <span className="text-2xl font-black text-[var(--text-main)]">{fmt(stats?.saldo)}</span>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex justify-between items-center p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                  <span className="text-[10px] font-black uppercase text-emerald-500">Liquidez Confirmada</span>
                  <span className="text-sm font-black text-emerald-500">{fmt(stats?.receita)}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                  <span className="text-[10px] font-black uppercase text-amber-500">Saldo Pendente</span>
                  <span className="text-sm font-black text-amber-500">{fmt(stats?.emRisco)}</span>
                </div>
              </div>
           </div>
           
        </div>
      ) : (
        <div className="bg-white dark:bg-white/5 border border-[var(--border-main)] rounded-[2.5rem] flex flex-col overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-8 border-b border-[var(--border-main)] flex flex-col lg:flex-row gap-6 items-center bg-gray-50/50 dark:bg-black/20">
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-gray-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Localizar transação no livro-razão..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-black/40 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-4 pl-14 pr-6 text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-gray-400 font-medium shadow-sm"
              />
            </div>
            <button className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-2xl border border-[var(--border-main)] text-[11px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95">
              <Filter className="w-4 h-4" /> Exportar Auditoria
            </button>
          </div>

          <div className="overflow-x-auto min-h-[500px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-black/40 text-[var(--text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">
                  <th className="p-8">Liquidação</th>
                  <th className="p-8">Descrição do Lançamento</th>
                  <th className="p-8">Categoria</th>
                  <th className="p-8 text-center">Status</th>
                  <th className="p-8 text-right">Montante</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]/50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-40 text-center">
                      <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-6" />
                      <p className="text-[var(--text-muted)] text-[11px] font-black uppercase tracking-widest">Sincronizando tesouraria...</p>
                    </td>
                  </tr>
                ) : filteredLancamentos.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-40 text-center text-[var(--text-muted)] italic text-sm font-medium opacity-50 uppercase tracking-widest">Nenhum lançamento identificado.</td>
                  </tr>
                ) : filteredLancamentos.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all group">
                    <td className="p-8 whitespace-nowrap">
                      <div className="text-[var(--text-main)] font-black text-sm tracking-tight">{format(parseISO(l.dataVencimento), 'dd/MM/yyyy')}</div>
                      <div className="text-[9px] text-[var(--text-muted)] font-black uppercase mt-1 opacity-50 tracking-tighter">Competência {format(parseISO(l.dataVencimento), 'MMMM', { locale: ptBR })}</div>
                    </td>
                    <td className="p-8">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-main)] font-black text-sm tracking-tight uppercase opacity-90 group-hover:text-blue-500 transition-colors">{l.descricao}</span>
                        <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-[0.15em] mt-1 opacity-60">{l.tipo === 'RECEITA' ? 'Recebimento de Cliente' : 'Pagamento de Fornecedor'}</span>
                      </div>
                    </td>
                    <td className="p-8">
                       <span className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-[var(--border-main)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest shadow-sm">
                        {l.categoria?.nome || 'Sem Categoria'}
                       </span>
                    </td>
                    <td className="p-8 text-center">
                       <span className={clsx(
                        "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border shadow-sm",
                        l.status === 'PAGO' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" :
                        l.status === 'ATRASADO' ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20" :
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                       )}>
                        {l.status}
                       </span>
                    </td>
                    <td className={clsx(
                      "p-8 text-right font-black whitespace-nowrap text-xl tracking-tighter",
                      l.tipo === 'RECEITA' ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {l.tipo === 'RECEITA' ? '+' : '-'} {fmt(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ModalNovoLancamento isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={carregarDados} />
      <ModalCategorias isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} />
    </div>
  );
}
