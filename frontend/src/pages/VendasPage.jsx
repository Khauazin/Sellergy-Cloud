import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShoppingBag, Plus, Search, Filter, 
  ChevronLeft, ChevronRight, MoreVertical,
  Calendar, User, Tag, ArrowRight, Loader2,
  TrendingUp, DollarSign, Users, Package,
  Zap, ArrowUpRight
} from 'lucide-react';
import api from '../services/api';
import Modal from '../components/Modal';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import clsx from 'clsx';

const fmt = (val) =>
  Number(val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const KpiCard = ({ label, value, loading, colorCls, icon: Icon, subLabel }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border-main)] p-6 rounded-[2rem] relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 shadow-sm">
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

export default function VendasPage() {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal de Nova Venda
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    variacaoId: '',
    leadId: '',
    quantidade: 1,
    valorTotal: 0,
    metodoPagamento: 'PIX',
    categoriaId: '',
    observacoes: ''
  });

  // Dados auxiliares para o formulário
  const [produtos, setProdutos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [resVendas, resProdutos, resLeads, resCats] = await Promise.all([
        api.get('/vendas'),
        api.get('/catalogo'),
        api.get('/crm/leads'),
        api.get('/financeiro/categorias')
      ]);
      setVendas(resVendas.data);
      setProdutos(resProdutos.data);
      setLeads(resLeads.data);
      setCategorias(resCats.data.filter(c => c.tipo === 'RECEITA'));
    } catch (error) {
      console.error('Erro ao carregar dados de vendas', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleSaveVenda = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post('/vendas', formData);
      await carregarDados();
      setIsModalOpen(false);
      setFormData({
        variacaoId: '', leadId: '', quantidade: 1, 
        valorTotal: 0, metodoPagamento: 'PIX', 
        categoriaId: '', observacoes: ''
      });
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao registrar venda.');
    } finally {
      setIsSaving(false);
    }
  };

  const stats = useMemo(() => {
    const totalVendido = vendas.reduce((acc, v) => acc + v.valor, 0);
    const totalVendas = vendas.length;
    const ticketMedio = totalVendas > 0 ? totalVendido / totalVendas : 0;
    const leadsConvertidos = new Set(vendas.filter(v => v.leadId).map(v => v.leadId)).size;

    return { totalVendido, totalVendas, ticketMedio, leadsConvertidos };
  }, [vendas]);

  const filteredVendas = vendas.filter(v => 
    v.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.lead?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-in fade-in duration-700">
      
      {/* Header Profissional */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">Operações de Venda</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
               <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.3em]">Acompanhamento Comercial em Tempo Real</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 dark:bg-white text-white dark:text-black px-8 py-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/10 hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-5 h-5" /> Nova Venda
        </button>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          label="Volume Total" 
          value={fmt(stats.totalVendido)} 
          loading={loading} 
          colorCls="text-blue-500" 
          icon={DollarSign} 
          subLabel="Total faturado"
        />
        <KpiCard 
          label="Conversões" 
          value={stats.totalVendas} 
          loading={loading} 
          colorCls="text-emerald-500" 
          icon={Zap} 
          subLabel="Vendas concluídas"
        />
        <KpiCard 
          label="Ticket Médio" 
          value={fmt(stats.ticketMedio)} 
          loading={loading} 
          colorCls="text-purple-500" 
          icon={TrendingUp} 
          subLabel="Média por pedido"
        />
        <KpiCard 
          label="Clientes Atendidos" 
          value={stats.leadsConvertidos} 
          loading={loading} 
          colorCls="text-amber-500" 
          icon={Users} 
          subLabel="Base convertida"
        />
      </div>

      {/* Toolbar & Tabela */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-[2.5rem] flex flex-col overflow-hidden shadow-sm">
        <div className="p-6 border-b border-[var(--border-main)] flex flex-col lg:flex-row gap-4 items-center bg-gray-50/50 dark:bg-black/20">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por cliente, produto ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-black/40 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all placeholder:text-gray-400"
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-xl border border-[var(--border-main)] text-[10px] font-black uppercase tracking-widest transition-all">
            <Filter className="w-3.5 h-3.5" /> Filtros Avançados
          </button>
        </div>

        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-black/40 text-[var(--text-muted)] text-[10px] uppercase font-black tracking-[0.2em]">
                <th className="p-6">Data & Hora</th>
                <th className="p-6">Nome do Cliente</th>
                <th className="p-6">Item de Venda</th>
                <th className="p-6 text-center">Pagamento</th>
                <th className="p-6 text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-32 text-center">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest">Sincronizando livro-razão...</p>
                  </td>
                </tr>
              ) : filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-32 text-center text-[var(--text-muted)] italic text-sm font-medium">Nenhuma transação comercial registrada no período.</td>
                </tr>
              ) : filteredVendas.map((venda) => (
                <tr key={venda.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all group cursor-default">
                  <td className="p-6 whitespace-nowrap">
                    <div className="text-[var(--text-main)] font-black text-sm tracking-tight">{format(parseISO(venda.criadoEm), 'dd/MM/yyyy')}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase mt-1">{format(parseISO(venda.criadoEm), 'HH:mm')}</div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-sm group-hover:scale-110 transition-transform">
                        <User className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[var(--text-main)] font-bold text-sm tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{venda.lead?.nome || 'Venda Direta'}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tighter">{venda.lead?.telefone || '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[var(--text-main)] text-xs font-bold max-w-[300px] truncate opacity-80">
                        {venda.movimentacoesEstoque?.[0]?.variacao?.produto?.nome || venda.descricao || 'Produto não especificado'}
                      </span>
                      {venda.movimentacoesEstoque?.length > 0 && (
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] text-blue-600 dark:text-blue-400/60 font-black uppercase border border-blue-200 dark:border-blue-400/20 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-transparent">
                            {Math.abs(venda.movimentacoesEstoque[0].quantidade)}x {venda.movimentacoesEstoque[0].variacao?.nome}
                           </span>
                           <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase">SKU: {venda.movimentacoesEstoque[0].variacao?.sku || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex justify-center">
                       <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-[var(--border-main)] text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest shadow-sm">
                        {venda.metodoPagamento}
                       </span>
                    </div>
                  </td>
                  <td className="p-6 text-right font-black whitespace-nowrap text-lg tracking-tighter text-emerald-600 dark:text-emerald-400">
                    {fmt(venda.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação Estilo Enterprise */}
        <div className="p-6 border-t border-[var(--border-main)] bg-gray-50/50 dark:bg-black/40 flex items-center justify-between">
           <p className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-[0.2em]">Total de {filteredVendas.length} transações</p>
           <div className="flex gap-3">
              <button className="p-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-[var(--border-main)] rounded-2xl disabled:opacity-20 transition-all shadow-sm">
                 <ChevronLeft className="w-4 h-4 text-[var(--text-main)]" />
              </button>
              <button className="p-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-[var(--border-main)] rounded-2xl disabled:opacity-20 transition-all shadow-sm">
                 <ChevronRight className="w-4 h-4 text-[var(--text-main)]" />
              </button>
           </div>
        </div>
      </div>

      {/* Modal de Nova Venda */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Terminal de Vendas">
        <form onSubmit={handleSaveVenda} className="space-y-6 p-2 max-h-[85vh] overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">
          
          <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-3xl mb-2 flex items-center gap-4">
             <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                <Package className="w-5 h-5" />
             </div>
             <div>
                <p className="text-blue-900 dark:text-white text-xs font-black uppercase tracking-widest">Pedido de Venda</p>
                <p className="text-blue-600 dark:text-blue-400/60 text-[10px] font-bold uppercase mt-0.5">Configure o item e o cliente</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Escolher Produto</label>
              <select
                required
                value={formData.variacaoId}
                onChange={e => {
                  const vId = e.target.value;
                  const prod = produtos.find(p => p.variacoes.some(v => v.id === vId));
                  const variacao = prod?.variacoes.find(v => v.id === vId);
                  setFormData({ ...formData, variacaoId: vId, valorTotal: (variacao?.preco || 0) * formData.quantidade });
                }}
                className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all appearance-none text-sm font-bold shadow-sm"
              >
                <option value="">Selecione um item...</option>
                {produtos.map(p => p.variacoes.map(v => (
                  <option key={v.id} value={v.id}>{p.nome} - {v.nome} ({fmt(v.preco)})</option>
                )))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Vincular Cliente</label>
              <select
                value={formData.leadId}
                onChange={e => setFormData({ ...formData, leadId: e.target.value })}
                className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all appearance-none text-sm font-bold shadow-sm"
              >
                <option value="">Venda Direta (Sem Registro)</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
             <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Qtd</label>
              <input
                type="number" min="1"
                required
                value={formData.quantidade}
                onChange={e => {
                  const q = Math.max(1, parseInt(e.target.value) || 1);
                  const vId = formData.variacaoId;
                  const prod = produtos.find(p => p.variacoes.some(v => v.id === vId));
                  const variacao = prod?.variacoes.find(v => v.id === vId);
                  setFormData({ ...formData, quantidade: q, valorTotal: (variacao?.preco || 0) * q });
                }}
                className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all text-sm font-black text-center shadow-sm"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Total do Pedido</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-black">R$</span>
                <input
                  type="number" step="0.01"
                  min="0.01"
                  required
                  value={formData.valorTotal}
                  onChange={e => setFormData({ ...formData, valorTotal: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-blue-500 transition-all text-lg font-black text-emerald-600 dark:text-emerald-400 shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl flex items-center gap-4">
             <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                <DollarSign className="w-5 h-5" />
             </div>
             <div>
                <p className="text-emerald-900 dark:text-white text-xs font-black uppercase tracking-widest">Financeiro & Recebimento</p>
                <p className="text-emerald-600 dark:text-emerald-400/60 text-[10px] font-bold uppercase mt-0.5">Conciliação automática em tempo real</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Forma de Pagamento</label>
              <select
                value={formData.metodoPagamento}
                onChange={e => setFormData({ ...formData, metodoPagamento: e.target.value })}
                className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-all appearance-none text-sm font-bold shadow-sm"
              >
                <option value="PIX">PIX (Instantâneo)</option>
                <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                <option value="DINHEIRO">Dinheiro / Espécie</option>
                <option value="BOLETO">Boleto Bancário</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Classificação Financeira</label>
              <select
                required
                value={formData.categoriaId}
                onChange={e => setFormData({ ...formData, categoriaId: e.target.value })}
                className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-all appearance-none text-sm font-bold shadow-sm"
              >
                <option value="">Vincular categoria...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Notas da Transação</label>
            <textarea
              rows="2"
              value={formData.observacoes}
              onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
              className="w-full bg-white dark:bg-black/60 border border-[var(--border-main)] text-[var(--text-main)] rounded-2xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-all text-sm resize-none font-medium shadow-sm"
              placeholder="Notas adicionais sobre a entrega ou cliente..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 text-gray-400 hover:text-[var(--text-main)] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-all"
            >
              Descartar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-[2] bg-blue-600 dark:bg-white text-white dark:text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-95"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
              {isSaving ? 'Registrando...' : 'Finalizar Venda'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
