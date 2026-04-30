import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, CheckCircle2, AlertCircle, Info, Users } from 'lucide-react';
import api from '../services/api';
import { MODULOS_TENANT } from '../constants/permissoes';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Avatar, Badge,
  EmptyState, SearchBar, Switch, useToast
} from '../components/ui';

/**
 * Painel admin: liberar modulos por cliente.
 * Layout split: lista a esquerda, matriz a direita.
 */
export default function AdminPermissoesClientePage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const clienteParam = params.get('cliente');

  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [selecionadoId, setSelecionadoId] = useState(clienteParam);
  const [edicao, setEdicao] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/clientes');
      setClientes(r.data || []);
      const idInicial = clienteParam || r.data?.[0]?.id;
      if (idInicial) {
        const cli = r.data.find((c) => c.id === idInicial);
        if (cli) {
          setSelecionadoId(idInicial);
          setEdicao(cli.modulosLiberados || {});
        }
      }
    } catch {
      toast.error('Erro ao carregar clientes');
    } finally {
      setCarregando(false);
    }
  };

  const selecionar = (cliente) => {
    setSelecionadoId(cliente.id);
    setEdicao(cliente.modulosLiberados || {});
  };

  const clienteAtual = useMemo(
    () => clientes.find((c) => c.id === selecionadoId),
    [clientes, selecionadoId]
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nome?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  }, [clientes, busca]);

  const totalLiberados = Object.values(edicao).filter(Boolean).length;

  const teveAlteracao = useMemo(() => {
    if (!clienteAtual) return false;
    const original = clienteAtual.modulosLiberados || {};
    const todasChaves = new Set([...Object.keys(original), ...Object.keys(edicao)]);
    for (const chave of todasChaves) {
      if (Boolean(original[chave]) !== Boolean(edicao[chave])) return true;
    }
    return false;
  }, [clienteAtual, edicao]);

  const toggle = (id) => setEdicao((e) => ({ ...e, [id]: !e[id] }));

  const liberarTodos = () => {
    const completo = {};
    MODULOS_TENANT.forEach((m) => { completo[m.id] = true; });
    setEdicao(completo);
  };
  const bloquearTodos = () => {
    const vazio = {};
    MODULOS_TENANT.forEach((m) => { vazio[m.id] = false; });
    setEdicao(vazio);
  };

  const salvar = async () => {
    if (!clienteAtual) return;
    setSalvando(true);
    try {
      const { data } = await api.put(`/clientes/${clienteAtual.id}/modulos`, { modulosLiberados: edicao });
      setClientes((prev) => prev.map((c) => c.id === data.id ? { ...c, modulosLiberados: data.modulosLiberados } : c));
      setEdicao(data.modulosLiberados || {});
      toast.success('Modulos atualizados');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-160px)]">
      {/* Lista de clientes */}
      <aside className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-[var(--border-main)]">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente..." size="sm" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {carregando ? (
            <div className="text-center py-6 text-xs text-[var(--text-muted)]">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-6 text-xs text-[var(--text-muted)]">Nenhum cliente</div>
          ) : (
            filtrados.map((c) => {
              const ativo = c.id === selecionadoId;
              const total = Object.values(c.modulosLiberados || {}).filter(Boolean).length;
              return (
                <button
                  key={c.id}
                  onClick={() => selecionar(c)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-center gap-2.5 ${
                    ativo ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <Avatar name={c.nome} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold tracking-tight truncate ${ativo ? 'text-[var(--accent-text)]' : 'text-[var(--text-main)]'}`}>{c.nome}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{total}/{MODULOS_TENANT.length} modulos</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Painel direito - matriz */}
      <section className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl flex flex-col overflow-hidden">
        {!clienteAtual ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={Users} title="Selecione um cliente" description="Escolha um cliente a esquerda para configurar os modulos liberados." />
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-[var(--border-main)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold tracking-tight text-[var(--text-main)]">{clienteAtual.nome}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  <span className="font-semibold text-[var(--text-secondary)]">{totalLiberados}</span> de {MODULOS_TENANT.length} modulos liberados
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={bloquearTodos}>Bloquear todos</Button>
                <Button variant="secondary" size="sm" onClick={liberarTodos}>Liberar todos</Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {MODULOS_TENANT.map((modulo) => {
                  const liberado = edicao[modulo.id] === true;
                  const Icone = modulo.icone;
                  return (
                    <button
                      key={modulo.id}
                      type="button"
                      onClick={() => toggle(modulo.id)}
                      className={`text-left rounded-xl p-4 border-2 transition-colors ${
                        liberado
                          ? 'bg-[var(--accent-soft)]/50 border-[var(--accent-border)]'
                          : 'bg-transparent border-[var(--border-main)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${liberado ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'}`}>
                            <Icone size={14} strokeWidth={1.75} />
                          </div>
                          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{modulo.nome}</div>
                        </div>
                        <Switch checked={liberado} onChange={() => toggle(modulo.id)} size="sm" />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{modulo.descricao}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-main)] flex items-center justify-between gap-3">
              <div>
                {teveAlteracao && (
                  <div className="text-xs text-[var(--warning)] font-medium flex items-center gap-1.5">
                    <AlertCircle size={13} /> Alteracoes nao salvas
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                icon={Save}
                onClick={salvar}
                loading={salvando}
                disabled={!teveAlteracao}
              >
                Salvar
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
