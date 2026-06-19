import { useState, useEffect } from 'react';
import { KeyRound, Plus, Edit2, Trash2, RefreshCw, Activity, Cpu } from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, Input, Textarea, Select, Badge, EmptyState, useToast,
} from '../components/ui';
import Modal from '../components/Modal';

const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');
const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

const PERIODOS = [
  { value: '7', label: 'Ultimos 7 dias' },
  { value: '30', label: 'Ultimos 30 dias' },
  { value: '90', label: 'Ultimos 90 dias' },
];

export default function AdminIaPage() {
  const toast = useToast();
  const [tipos, setTipos] = useState([]);
  const [credenciais, setCredenciais] = useState([]);
  const [uso, setUso] = useState(null);
  const [periodo, setPeriodo] = useState('30');
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState({ open: false, tipo: null, credencial: null });

  const desdeISO = (dias) => new Date(Date.now() - Number(dias) * 24 * 60 * 60 * 1000).toISOString();

  const carregarUso = async (dias) => {
    try {
      const r = await api.get(`/admin/ia/uso?desde=${encodeURIComponent(desdeISO(dias))}`);
      setUso(r.data);
    } catch {
      setUso(null);
    }
  };

  const carregarCredenciais = async () => {
    const r = await api.get('/admin/ia/credenciais');
    setCredenciais(r.data || []);
  };

  const carregarTudo = async () => {
    setCarregando(true);
    try {
      const [tiposR] = await Promise.all([
        api.get('/admin/ia/tipos'),
        carregarCredenciais(),
        carregarUso(periodo),
      ]);
      setTipos(tiposR.data || []);
    } catch {
      toast.error('Erro ao carregar dados de IA');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao montar
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMudarPeriodo = (dias) => {
    setPeriodo(dias);
    carregarUso(dias);
  };

  const credencialDoTipo = (tipo) => credenciais.find((c) => c.tipo === tipo) || null;

  const handleSalvar = async (payload) => {
    try {
      if (payload.id) {
        await api.put(`/admin/ia/credenciais/${payload.id}`, payload.body);
        toast.success('Credencial atualizada');
      } else {
        await api.post('/admin/ia/credenciais', payload.body);
        toast.success('Credencial salva');
      }
      setModal({ open: false, tipo: null, credencial: null });
      carregarCredenciais();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar credencial');
    }
  };

  const handleRemover = async (c) => {
    if (!confirm(`Remover a chave "${c.nome}"? Os bots sem credencial propria deixarao de usar esse provedor.`)) return;
    try {
      await api.delete(`/admin/ia/credenciais/${c.id}`);
      toast.success('Credencial removida');
      carregarCredenciais();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-5">
      {/* ===== Credenciais de IA da plataforma ===== */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">Credenciais de IA da plataforma</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Chaves usadas por padrao pelos bots quando o tenant nao tem credencial propria. Uma por provedor.
          As chaves sao cifradas em repouso e nunca voltam pela API.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          {tipos.map((t) => {
            const c = credencialDoTipo(t.tipo);
            return (
              <div key={t.tipo} className="border border-[var(--border-main)] rounded-xl p-4 flex flex-col gap-3 bg-[var(--bg-subtle)]/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Cpu size={16} className="text-[var(--text-muted)] flex-shrink-0" />
                    <span className="font-semibold text-sm text-[var(--text-main)] truncate">{t.rotulo}</span>
                  </div>
                  {c
                    ? <Badge variant="success" size="sm">Configurada</Badge>
                    : <Badge variant="neutral" size="sm">Nao configurada</Badge>}
                </div>

                {c ? (
                  <>
                    <div className="text-sm text-[var(--text-secondary)] truncate" title={c.nome}>{c.nome}</div>
                    <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Atualizada em {fmtData(c.atualizadoEm)}
                      {c.ultimoUsoEm ? ` · ultimo uso ${fmtData(c.ultimoUsoEm)}` : ' · nunca usada'}
                    </div>
                    <div className="flex gap-2 mt-auto pt-1">
                      <Button variant="secondary" size="sm" icon={Edit2} onClick={() => setModal({ open: true, tipo: t, credencial: c })}>Editar</Button>
                      <Button variant="danger-soft" size="sm" icon={Trash2} onClick={() => handleRemover(c)}>Remover</Button>
                    </div>
                  </>
                ) : (
                  <div className="mt-auto pt-1">
                    <Button variant="primary" size="sm" icon={Plus} onClick={() => setModal({ open: true, tipo: t, credencial: null })}>Configurar</Button>
                  </div>
                )}
              </div>
            );
          })}
          {!carregando && tipos.length === 0 && (
            <div className="md:col-span-3 text-sm text-[var(--text-muted)] py-4 text-center">Nenhum provedor disponivel.</div>
          )}
        </div>
      </Card>

      {/* ===== Uso de IA por tenant ===== */}
      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">Uso de IA por cliente</h2>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={periodo}
              onChange={(e) => handleMudarPeriodo(e.target.value)}
              options={PERIODOS}
              placeholder=""
              fullWidth={false}
              className="w-44"
            />
            <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => carregarUso(periodo)}>Atualizar</Button>
          </div>
        </div>

        {/* KPIs do periodo */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[var(--bg-subtle)] rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Tokens no periodo</div>
            <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums text-[var(--text-main)]">{fmtNum(uso?.totalTokens)}</div>
          </div>
          <div className="bg-[var(--bg-subtle)] rounded-xl p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Execucoes do agente</div>
            <div className="text-2xl font-semibold tracking-tight mt-1 tabular-nums text-[var(--text-main)]">{fmtNum(uso?.totalExecucoes)}</div>
          </div>
        </div>

        {carregando ? (
          <div className="text-center py-10 text-[var(--text-muted)] text-sm">Carregando...</div>
        ) : !uso || uso.tenants.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Sem uso de IA no periodo"
            description="Quando os bots conversarem usando a IA, o consumo por cliente aparece aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-main)]">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-3">Cliente</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-3">Plano</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-3">Execucoes</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-3">Tokens</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-3">Ultimo uso</th>
                </tr>
              </thead>
              <tbody>
                {uso.tenants.map((t) => (
                  <tr key={t.clienteId} className="border-b border-[var(--border-subtle)]">
                    <td className="py-2.5 px-3 text-sm font-medium text-[var(--text-main)]">{t.nome}</td>
                    <td className="py-2.5 px-3"><Badge variant="neutral" size="sm">{t.plano || '—'}</Badge></td>
                    <td className="py-2.5 px-3 text-right text-sm tabular-nums text-[var(--text-secondary)]">{fmtNum(t.execucoes)}</td>
                    <td className="py-2.5 px-3 text-right text-sm font-semibold tabular-nums text-[var(--text-main)]">{fmtNum(t.tokens)}</td>
                    <td className="py-2.5 px-3 text-xs text-[var(--text-muted)]">{fmtData(t.ultimoUso)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quebra por provedor / modelo */}
        {uso && uso.provedores && uso.provedores.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Por provedor e modelo</div>
            <div className="flex flex-wrap gap-2">
              {uso.provedores.map((p, i) => (
                <div key={`${p.provedor}-${p.modelo}-${i}`} className="border border-[var(--border-subtle)] rounded-lg px-3 py-2 bg-[var(--bg-card)]">
                  <div className="text-xs font-semibold text-[var(--text-main)]">{p.provedor} · {p.modelo}</div>
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">{fmtNum(p.tokens)} tokens · {fmtNum(p.execucoes)} exec.</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <ModalCredencial
        isOpen={modal.open}
        onClose={() => setModal({ open: false, tipo: null, credencial: null })}
        tipo={modal.tipo}
        credencial={modal.credencial}
        onSalvar={handleSalvar}
      />
    </div>
  );
}

function ModalCredencial({ isOpen, onClose, tipo, credencial, onSalvar }) {
  const [form, setForm] = useState({ nome: '', apiKey: '', organizationId: '', descricao: '' });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o form ao abrir/trocar de alvo
    setForm({
      nome: credencial?.nome || (tipo ? `IA ${tipo.rotulo}` : ''),
      apiKey: '',
      organizationId: '',
      descricao: credencial?.descricao || '',
    });
  }, [credencial, tipo, isOpen]);

  if (!tipo) return null;
  const editando = !!credencial;
  const temOrg = (tipo.schema?.opcionais || []).includes('organizationId');

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = { nome: form.nome.trim(), descricao: form.descricao.trim() || null };
    if (!editando) body.tipo = tipo.tipo;
    if (form.apiKey.trim()) {
      body.dados = { apiKey: form.apiKey.trim() };
      if (temOrg && form.organizationId.trim()) body.dados.organizationId = form.organizationId.trim();
    }
    onSalvar(editando ? { id: credencial.id, body } : { body });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${editando ? 'Editar' : 'Configurar'} ${tipo.rotulo}`}
      description="A chave e cifrada em repouso e nunca volta pela API."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome / identificacao"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          required
          autoFocus
        />
        <Input
          label={editando ? 'Nova chave de API (deixe em branco para manter a atual)' : 'Chave de API'}
          type="password"
          value={form.apiKey}
          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          required={!editando}
          placeholder={editando ? '••••••••••••' : 'Cole a chave aqui'}
          autoComplete="off"
        />
        {temOrg && (
          <Input
            label="Organization ID (opcional)"
            value={form.organizationId}
            onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
            placeholder={editando ? 'Reenvie se trocar a chave' : 'org-...'}
          />
        )}
        <Textarea
          label="Descricao (opcional)"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={2}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">{editando ? 'Salvar' : 'Configurar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
