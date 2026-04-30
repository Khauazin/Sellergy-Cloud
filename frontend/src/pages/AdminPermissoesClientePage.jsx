import { useEffect, useMemo, useState } from 'react';
import { Search, Save, CheckCircle2, AlertCircle, Loader2, Filter, ShieldCheck, Info } from 'lucide-react';
import api from '../services/api';
import { MODULOS_TENANT } from '../constants/permissoes';
import clsx from 'clsx';

/**
 * Painel do ADMIN para liberar/bloquear modulos por cliente.
 * Cada cliente tem uma matriz booleana modulosLiberados.
 */
export default function AdminPermissoesClientePage() {
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState(null);
  const [edicao, setEdicao] = useState({}); // { [moduloId]: bool } - copia local em edicao
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tipo, mensagem }

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/clientes');
      setClientes(data || []);
      if (data?.length > 0 && !clienteSelecionadoId) {
        selecionarCliente(data[0]);
      }
    } catch (e) {
      console.error('Erro ao carregar clientes', e);
      setFeedback({ tipo: 'erro', mensagem: 'Falha ao carregar clientes.' });
    } finally {
      setCarregando(false);
    }
  };

  const selecionarCliente = (cliente) => {
    setClienteSelecionadoId(cliente.id);
    setEdicao(cliente.modulosLiberados || {});
    setFeedback(null);
  };

  const clienteAtual = useMemo(
    () => clientes.find((c) => c.id === clienteSelecionadoId),
    [clientes, clienteSelecionadoId]
  );

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) => c.nome?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [clientes, busca]);

  const modulosLiberadosCount = useMemo(
    () => Object.values(edicao).filter(Boolean).length,
    [edicao]
  );

  const teveAlteracao = useMemo(() => {
    if (!clienteAtual) return false;
    const original = clienteAtual.modulosLiberados || {};
    const todasChaves = new Set([...Object.keys(original), ...Object.keys(edicao)]);
    for (const chave of todasChaves) {
      if (Boolean(original[chave]) !== Boolean(edicao[chave])) return true;
    }
    return false;
  }, [clienteAtual, edicao]);

  const toggleModulo = (moduloId) => {
    setEdicao((prev) => ({ ...prev, [moduloId]: !prev[moduloId] }));
    setFeedback(null);
  };

  const liberarTodos = () => {
    const completo = {};
    MODULOS_TENANT.forEach((m) => { completo[m.id] = true; });
    setEdicao(completo);
    setFeedback(null);
  };

  const bloquearTodos = () => {
    const vazio = {};
    MODULOS_TENANT.forEach((m) => { vazio[m.id] = false; });
    setEdicao(vazio);
    setFeedback(null);
  };

  const salvar = async () => {
    if (!clienteAtual) return;
    setSalvando(true);
    setFeedback(null);
    try {
      const { data } = await api.put(`/clientes/${clienteAtual.id}/modulos`, {
        modulosLiberados: edicao
      });
      // Atualiza local
      setClientes((prev) =>
        prev.map((c) => (c.id === data.id ? { ...c, modulosLiberados: data.modulosLiberados } : c))
      );
      setEdicao(data.modulosLiberados || {});
      setFeedback({ tipo: 'sucesso', mensagem: 'Modulos atualizados com sucesso.' });
    } catch (e) {
      console.error(e);
      setFeedback({
        tipo: 'erro',
        mensagem: e.response?.data?.erro || 'Erro ao salvar modulos.'
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header explicativo */}
      <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-3xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">
              Modulos liberados por cliente
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-2xl leading-relaxed">
              Defina quais modulos cada cliente assinante tem acesso. Modulos bloqueados nao aparecem no menu do cliente nem podem ser acessados via API. Use isso para refletir o que ele contratou.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

        {/* Lista de clientes */}
        <aside className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl overflow-hidden flex flex-col max-h-[75vh]">
          <div className="p-4 border-b border-[var(--border-main)]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded-2xl py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:border-blue-500/50 font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
            {carregando ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : clientesFiltrados.length === 0 ? (
              <div className="p-6 text-center">
                <Filter className="w-6 h-6 mx-auto text-[var(--text-muted)] opacity-50" />
                <p className="text-xs text-[var(--text-muted)] mt-2 font-medium">Nenhum cliente encontrado.</p>
              </div>
            ) : (
              clientesFiltrados.map((c) => {
                const ativo = c.id === clienteSelecionadoId;
                const totalModulos = Object.values(c.modulosLiberados || {}).filter(Boolean).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => selecionarCliente(c)}
                    className={clsx(
                      'w-full text-left rounded-2xl px-4 py-3 transition-all border',
                      ativo
                        ? 'bg-blue-500/10 border-blue-500/30'
                        : 'bg-transparent border-transparent hover:bg-[var(--bg-app)]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx('font-bold text-sm tracking-tight truncate', ativo ? 'text-blue-500' : 'text-[var(--text-main)]')}>
                        {c.nome}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-[var(--bg-app)] text-[var(--text-muted)] flex-shrink-0">
                        {totalModulos}/{MODULOS_TENANT.length}
                      </span>
                    </div>
                    {c.email && (
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate font-medium">{c.email}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Painel direito - matriz de modulos */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl">
          {!clienteAtual ? (
            <div className="p-12 text-center">
              <Info className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
              <p className="text-sm text-[var(--text-muted)] mt-3 font-medium">
                Selecione um cliente para configurar os modulos.
              </p>
            </div>
          ) : (
            <>
              {/* Header do cliente */}
              <div className="p-6 border-b border-[var(--border-main)] flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-[var(--text-main)] tracking-tighter uppercase italic">
                    {clienteAtual.nome}
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
                    {clienteAtual.email || 'Sem email cadastrado'} ·{' '}
                    <span className="text-[var(--text-main)] font-bold">{modulosLiberadosCount}</span> de {MODULOS_TENANT.length} modulos liberados
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={bloquearTodos}
                    className="text-xs font-bold uppercase tracking-tight px-4 py-2 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                  >
                    Bloquear todos
                  </button>
                  <button
                    onClick={liberarTodos}
                    className="text-xs font-bold uppercase tracking-tight px-4 py-2 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20 transition-colors"
                  >
                    Liberar todos
                  </button>
                </div>
              </div>

              {/* Cards de modulos */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                {MODULOS_TENANT.map((modulo) => {
                  const liberado = edicao[modulo.id] === true;
                  const Icone = modulo.icone;
                  return (
                    <button
                      key={modulo.id}
                      onClick={() => toggleModulo(modulo.id)}
                      className={clsx(
                        'group text-left rounded-2xl p-5 border-2 transition-all',
                        liberado
                          ? 'bg-blue-500/5 border-blue-500/30 hover:border-blue-500/50'
                          : 'bg-[var(--bg-app)]/50 border-[var(--border-main)] hover:border-[var(--text-muted)]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                            liberado ? 'bg-blue-500/20 text-blue-500' : 'bg-[var(--border-main)] text-[var(--text-muted)]'
                          )}>
                            <Icone className="w-5 h-5" />
                          </div>
                          <h3 className="font-black text-sm uppercase tracking-tight text-[var(--text-main)]">
                            {modulo.nome}
                          </h3>
                        </div>
                        <Toggle ativo={liberado} />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                        {modulo.descricao}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Footer de acao */}
              <div className="p-6 border-t border-[var(--border-main)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  {feedback?.tipo === 'sucesso' && (
                    <div className="inline-flex items-center gap-2 text-sm text-emerald-500 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> {feedback.mensagem}
                    </div>
                  )}
                  {feedback?.tipo === 'erro' && (
                    <div className="inline-flex items-center gap-2 text-sm text-red-500 font-medium">
                      <AlertCircle className="w-4 h-4" /> {feedback.mensagem}
                    </div>
                  )}
                  {!feedback && teveAlteracao && (
                    <p className="text-sm text-amber-500 font-medium">Alteracoes nao salvas.</p>
                  )}
                </div>

                <button
                  onClick={salvar}
                  disabled={!teveAlteracao || salvando}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-sm tracking-tight transition-all',
                    teveAlteracao && !salvando
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-[0.99]'
                      : 'bg-[var(--border-main)] text-[var(--text-muted)] cursor-not-allowed'
                  )}
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {salvando ? 'Salvando...' : 'Salvar alteracoes'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Toggle({ ativo }) {
  return (
    <div className={clsx(
      'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
      ativo ? 'bg-blue-500' : 'bg-[var(--border-main)]'
    )}>
      <div className={clsx(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform',
        ativo ? 'translate-x-5' : 'translate-x-0.5'
      )} />
    </div>
  );
}
