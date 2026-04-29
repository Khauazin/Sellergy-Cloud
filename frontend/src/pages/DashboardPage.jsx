import { useState, useEffect } from 'react';
import {
  Users,
  Bot,
  MessageSquare,
  DollarSign,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

const fmt = (val) =>
  Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const KpiCard = ({ title, value, icon: Icon, trend, colorCls }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-[2.5rem] relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 shadow-sm">
    <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.02] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
    
    <div className="flex justify-between items-start mb-4 relative z-10">
      <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
      <div className={clsx("p-2.5 rounded-2xl bg-current opacity-10", colorCls)}>
         <Icon className={clsx("w-5 h-5", colorCls)} />
      </div>
    </div>

    <div className="flex items-end justify-between relative z-10">
      <h3 className={clsx('text-3xl font-black tracking-tighter transition-all duration-500 group-hover:translate-x-1', colorCls)}>
        {value}
      </h3>
      {trend && (
        <div className={clsx("flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full bg-current opacity-20", colorCls)}>
           <ArrowUpRight className="w-3 h-3" />
           {trend}
        </div>
      )}
    </div>
  </div>
);

const data = [
  { name: 'Seg', leads: 40, conversao: 24 },
  { name: 'Ter', leads: 30, conversao: 13 },
  { name: 'Qua', leads: 20, conversao: 98 },
  { name: 'Qui', leads: 27, conversao: 39 },
  { name: 'Sex', leads: 18, conversao: 48 },
  { name: 'Sáb', leads: 23, conversao: 38 },
  { name: 'Dom', leads: 34, conversao: 43 },
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-in fade-in duration-700">
      
      {/* Header Enterprise */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">Operações Globais</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
               <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em]">Monitoramento de Performance de Rede</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="px-6 py-2.5 rounded-2xl bg-gray-100 dark:bg-white/5 border border-[var(--border-main)] flex items-center gap-3 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest">Sistema Seguro</span>
           </div>
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Total de Leads" value="1,284" icon={Users} trend="+12%" colorCls="text-blue-500" />
        <KpiCard title="Automações" value="12" icon={Bot} trend="Ativas" colorCls="text-purple-500" />
        <KpiCard title="Mensagens/Dia" value="45.2k" icon={MessageSquare} trend="+8%" colorCls="text-amber-500" />
        <KpiCard title="Receita Estimada" value={fmt(124500)} icon={DollarSign} trend="+5%" colorCls="text-emerald-500" />
      </div>

      {/* Gráficos e Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2.5rem] p-8 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
             <div>
                <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-widest">Fluxo de Conversão</h3>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase mt-1">Performance Semanal de Aquisição</p>
             </div>
             <div className="flex gap-4">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500" />
                   <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tighter">Leads</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500" />
                   <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-tighter">Vendas</span>
                </div>
             </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#0a0a0a' : '#fff', 
                    borderRadius: '20px', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                  }}
                />
                <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="conversao" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorVendas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Stats */}
        <div className="space-y-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2.5rem] p-8 shadow-sm h-full">
            <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-widest mb-6">Status da Rede</h3>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-3xl border border-[var(--border-main)] transition-all hover:translate-x-1 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">API de Builder</span>
                  <span className="text-[9px] font-black text-emerald-500 uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm">Online</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full w-[98%] bg-emerald-500 rounded-full" />
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-3xl border border-[var(--border-main)] transition-all hover:translate-x-1 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase">Node de Atendimento</span>
                  <span className="text-[9px] font-black text-emerald-500 uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm">Online</span>
                </div>
                <div className="h-1.5 w-full bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full w-[94%] bg-emerald-500 rounded-full" />
                </div>
              </div>

              <div className="mt-10 p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl">
                <h4 className="text-blue-900 dark:text-blue-400 text-xs font-black uppercase tracking-widest mb-1 italic">Conectividade Global</h4>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase mt-1 leading-relaxed">Latência média: 45ms. Zero perdas de pacotes na última hora.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
