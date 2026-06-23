import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Plus, RefreshCw, QrCode, Link as LinkIcon, Lock } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Badge, EmptyState,
  Input, Select, Drawer, useToast,
} from '../components/ui';
import pagamentosService from '../services/pagamentosService';
import credenciaisService from '../services/credenciaisService';

// Provedores suportados + o tipo de credencial que cada um exige (espelha
// backend/src/adapters/pagamento/index.js).
const PROVEDORES = [
  { id: 'MERCADO_PAGO', nome: 'Mercado Pago', tipoCredencial: 'MERCADO_PAGO_KEY' },
  { id: 'ASAAS', nome: 'Asaas', tipoCredencial: 'ASAAS_KEY' },
  { id: 'PAGARME', nome: 'Pagar.me', tipoCredencial: 'PAGARME_KEY' },
];
const TIPO_POR_PROVEDOR = Object.fromEntries(PROVEDORES.map((p) => [p.id, p.tipoCredencial]));

const STATUS_VARIANT = {
  PENDENTE: 'warning', PAGO: 'success', EXPIRADO: 'neutral',
  CANCELADO: 'danger', ESTORNADO: 'neutral',
};

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PagamentosPage() {
  const toast = useToast();
  const [credenciais, setCredenciais] = useState([]);
  const [cobrancas, setCobrancas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ provedor: '', credencialId: '', ativo: true });
  const [drawerAberto, setDrawerAberto] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [cfg, creds, cobs] = await Promise.all([
        pagamentosService.obterConfig().catch(() => null),
        credenciaisService.listar().catch(() => []),
        pagamentosService.listarCobrancas().catch(() => []),
      ]);
      setCredenciais(creds);
      setCobrancas(cobs);
      setForm({
        provedor: cfg?.provedor || '',
        credencialId: cfg?.credencialId || '',
        ativo: cfg?.ativo ?? true,
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  // Credenciais compativeis com o provedor escolhido (pelo tipo).
  const credenciaisDoProvedor = form.provedor
    ? credenciais.filter((c) => c.tipo === TIPO_POR_PROVEDOR[form.provedor])
    : [];

  const salvarConfig = async () => {
    if (!form.provedor) return toast.error('Escolha um provedor.');
    setSalvando(true);
    try {
      await pagamentosService.salvarConfig(form);
      toast.success('Configuracao de pagamento salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar configuracao.');
    } finally {
      setSalvando(false);
    }
  };

  const sincronizar = async (id) => {
    try {
      const atualizada = await pagamentosService.sincronizar(id);
      setCobrancas((lista) => lista.map((c) => (c.id === id ? { ...c, ...atualizada } : c)));
      toast.success('Status atualizado.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao sincronizar.');
    }
  };

  const aoCriarCobranca = (nova) => {
    setCobrancas((lista) => [nova, ...lista]);
    setDrawerAberto(false);
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <Link to="/app/configuracoes" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
          Configuracoes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">Pagamentos</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Recebimento integrado: escolha um provedor (PSP), gere cobrancas Pix ou link de pagamento
          e acompanhe a confirmacao. A credencial fica cifrada no cofre.
        </p>
      </div>

      {/* Configuracao do provedor */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Provedor de pagamento</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={11} /> A chave de API e usada apenas no momento da cobranca.
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Provedor"
            value={form.provedor}
            onChange={(e) => setForm({ ...form, provedor: e.target.value, credencialId: '' })}
            options={[
              { value: '', label: 'Selecione...' },
              ...PROVEDORES.map((p) => ({ value: p.id, label: p.nome })),
            ]}
          />
          <Select
            label="Credencial (do cofre)"
            value={form.credencialId}
            onChange={(e) => setForm({ ...form, credencialId: e.target.value })}
            disabled={!form.provedor}
            options={[
              { value: '', label: credenciaisDoProvedor.length ? 'Selecione...' : 'Nenhuma credencial compativel' },
              ...credenciaisDoProvedor.map((c) => ({ value: c.id, label: c.nome })),
            ]}
          />
        </div>

        {form.provedor && credenciaisDoProvedor.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Cadastre uma credencial do tipo <strong>{TIPO_POR_PROVEDOR[form.provedor]}</strong> em{' '}
            <Link to="/app/configuracoes/credenciais" className="underline">Credenciais</Link> para ativar este provedor.
          </p>
        )}

        <div className="flex items-center justify-between mt-5">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo
          </label>
          <Button variant="accent" onClick={salvarConfig} loading={salvando} disabled={!form.provedor}>
            Salvar configuracao
          </Button>
        </div>
      </Card>

      {/* Cobrancas */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>
              {cobrancas.length} {cobrancas.length === 1 ? 'cobranca' : 'cobrancas'}
            </CardTitle>
            <CardDescription>Pix e links gerados, com status de confirmacao.</CardDescription>
          </div>
          <Button variant="accent" icon={Plus} onClick={() => setDrawerAberto(true)} disabled={!form.provedor}>
            Nova cobranca
          </Button>
        </CardHeader>

        {carregando ? (
          <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando...</div>
        ) : cobrancas.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma cobranca ainda"
            description="Gere a primeira cobranca Pix ou link de pagamento para o seu cliente."
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {cobrancas.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
                  {c.metodo === 'PIX' ? <QrCode size={16} /> : <LinkIcon size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--text-main)]">{fmtBRL(c.valor)}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {c.metodo} · {c.provedor} · {c.origem}{c.refId ? ` (${c.refId})` : ''}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[c.status] || 'neutral'} size="sm">{c.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => sincronizar(c.id)}
                  disabled={c.status === 'PAGO' || c.status === 'ESTORNADO'}
                >
                  Sincronizar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NovaCobrancaDrawer
        aberto={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        onCriada={aoCriarCobranca}
      />
    </div>
  );
}

// --- Drawer "Nova cobranca" ---
function NovaCobrancaDrawer({ aberto, onClose, onCriada }) {
  const toast = useToast();
  const [form, setForm] = useState({ valor: '', metodo: 'PIX', descricao: '', origem: 'AVULSA', refId: '' });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fechar = () => {
    setForm({ valor: '', metodo: 'PIX', descricao: '', origem: 'AVULSA', refId: '' });
    setResultado(null);
    onClose();
  };

  const criar = async () => {
    const valorNum = Number(form.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) return toast.error('Informe um valor valido.');
    setEnviando(true);
    try {
      const nova = await pagamentosService.criarCobranca({
        valor: valorNum,
        metodo: form.metodo,
        descricao: form.descricao || undefined,
        origem: form.origem,
        refId: form.refId || undefined,
      });
      setResultado(nova);
      onCriada(nova);
      toast.success('Cobranca criada.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao criar cobranca.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Drawer isOpen={aberto} onClose={fechar} title="Nova cobranca" description="Gera um Pix ou link de pagamento.">
      {resultado ? (
        <div className="space-y-4">
          <Badge variant="success" size="sm">{resultado.status}</Badge>
          {resultado.qrCode && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Pix copia-e-cola</p>
              <textarea
                readOnly
                value={resultado.qrCode}
                className="w-full text-xs font-mono p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)]"
                rows={3}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          {resultado.linkUrl && (
            <a href={resultado.linkUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)] underline break-all">
              {resultado.linkUrl}
            </a>
          )}
          <Button variant="secondary" onClick={fechar}>Fechar</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Valor (R$)"
            type="number"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            placeholder="0,00"
          />
          <Select
            label="Metodo"
            value={form.metodo}
            onChange={(e) => setForm({ ...form, metodo: e.target.value })}
            options={[{ value: 'PIX', label: 'Pix (QR + copia-e-cola)' }, { value: 'LINK', label: 'Link de pagamento' }]}
          />
          <Input
            label="Descricao"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Ex: Consulta, Pedido #123"
          />
          <Button variant="accent" onClick={criar} loading={enviando} className="w-full">
            Gerar cobranca
          </Button>
        </div>
      )}
    </Drawer>
  );
}
