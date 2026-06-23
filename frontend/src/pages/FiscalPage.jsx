import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Plus, RefreshCw, FileText, Download, Lock } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Badge, EmptyState,
  Input, Select, Drawer, useToast,
} from '../components/ui';
import fiscalService from '../services/fiscalService';
import credenciaisService from '../services/credenciaisService';

// Emissores suportados + o tipo de credencial exigido (espelha
// backend/src/adapters/fiscal/index.js).
const PROVEDORES = [
  { id: 'FOCUS_NFE', nome: 'Focus NFe', tipoCredencial: 'FOCUS_NFE_KEY' },
  { id: 'NUVEM_FISCAL', nome: 'Nuvem Fiscal', tipoCredencial: 'NUVEM_FISCAL_KEY' },
];
const TIPO_POR_PROVEDOR = Object.fromEntries(PROVEDORES.map((p) => [p.id, p.tipoCredencial]));

const STATUS_VARIANT = {
  PENDENTE: 'warning', PROCESSANDO: 'warning', EMITIDA: 'success',
  ERRO: 'danger', CANCELADA: 'neutral',
};

export default function FiscalPage() {
  const toast = useToast();
  const [credenciais, setCredenciais] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [form, setForm] = useState({
    provedor: '', credencialId: '', ambiente: 'HOMOLOGACAO',
    cnpj: '', regime: '', inscricao: '', csc: '', serie: '', ativo: true,
  });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [cfg, creds, docs] = await Promise.all([
        fiscalService.obterConfig().catch(() => null),
        credenciaisService.listar().catch(() => []),
        fiscalService.listarDocumentos().catch(() => []),
      ]);
      setCredenciais(creds || []);
      setDocumentos(docs || []);
      if (cfg) {
        setForm((f) => ({
          ...f,
          provedor: cfg.provedor || '',
          credencialId: cfg.credencialId || '',
          ambiente: cfg.ambiente || 'HOMOLOGACAO',
          cnpj: cfg.cnpj || '',
          regime: cfg.regime || '',
          inscricao: cfg.inscricao || '',
          csc: cfg.csc || '',
          serie: cfg.serie || '',
          ativo: cfg.ativo ?? true,
        }));
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  const credenciaisDoProvedor = form.provedor
    ? credenciais.filter((c) => c.tipo === TIPO_POR_PROVEDOR[form.provedor])
    : [];

  const salvarConfig = async () => {
    if (!form.provedor) return toast.error('Escolha um emissor.');
    setSalvando(true);
    try {
      await fiscalService.salvarConfig(form);
      toast.success('Configuracao fiscal salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar configuracao.');
    } finally {
      setSalvando(false);
    }
  };

  const sincronizar = async (id) => {
    try {
      const atualizado = await fiscalService.sincronizar(id);
      setDocumentos((lista) => lista.map((d) => (d.id === id ? { ...d, ...atualizado } : d)));
      toast.success('Status atualizado.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao sincronizar.');
    }
  };

  const aoEmitir = (novo) => {
    setDocumentos((lista) => [novo, ...lista]);
    setDrawerAberto(false);
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <Link to="/app/configuracoes" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
          Configuracoes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">Fiscal</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Emissao de nota via provedor (NFC-e para loja, NFS-e para servico). Configure o emissor
          e acompanhe os documentos. A emissao real depende do certificado e do ambiente.
        </p>
      </div>

      {/* Config do emissor */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Emissor fiscal</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={11} /> A nota e emitida via API de terceiro; a chave fica cifrada no cofre.
              </span>
            </CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Emissor"
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
          <Select
            label="Ambiente"
            value={form.ambiente}
            onChange={(e) => setForm({ ...form, ambiente: e.target.value })}
            options={[
              { value: 'HOMOLOGACAO', label: 'Homologacao (teste)' },
              { value: 'PRODUCAO', label: 'Producao' },
            ]}
          />
          <Input label="CNPJ" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          <Input label="Regime tributario" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })} placeholder="Simples / Presumido / Real" />
          <Input label="Inscricao estadual/municipal" value={form.inscricao} onChange={(e) => setForm({ ...form, inscricao: e.target.value })} />
          <Input label="CSC (NFC-e)" value={form.csc} onChange={(e) => setForm({ ...form, csc: e.target.value })} />
          <Input label="Serie" value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} placeholder="1" />
        </div>

        {form.provedor && credenciaisDoProvedor.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Cadastre uma credencial do tipo <strong>{TIPO_POR_PROVEDOR[form.provedor]}</strong> em{' '}
            <Link to="/app/configuracoes/credenciais" className="underline">Credenciais</Link> para ativar este emissor.
          </p>
        )}

        <div className="flex items-center justify-between mt-5">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativo
          </label>
          <Button variant="accent" onClick={salvarConfig} loading={salvando} disabled={!form.provedor}>
            Salvar configuracao
          </Button>
        </div>
      </Card>

      {/* Documentos */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>{documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}</CardTitle>
            <CardDescription>NFC-e e NFS-e emitidas, com status e arquivos.</CardDescription>
          </div>
          <Button variant="accent" icon={Plus} onClick={() => setDrawerAberto(true)} disabled={!form.provedor}>
            Emitir documento
          </Button>
        </CardHeader>

        {carregando ? (
          <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando...</div>
        ) : documentos.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhum documento ainda"
            description="Emita a primeira NFC-e ou NFS-e para acompanhar aqui."
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {documentos.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)]">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--text-main)]">
                    {d.tipo}{d.numero ? ` #${d.numero}` : ''}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {d.provedor}{d.chave ? ` · ${d.chave}` : ''}{d.mensagemErro ? ` · ${d.mensagemErro}` : ''}
                  </div>
                </div>
                {d.urlPdf && (
                  <a href={d.urlPdf} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] inline-flex items-center gap-1 hover:underline">
                    <Download size={12} /> PDF
                  </a>
                )}
                <Badge variant={STATUS_VARIANT[d.status] || 'neutral'} size="sm">{d.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                  onClick={() => sincronizar(d.id)}
                  disabled={d.status === 'EMITIDA' || d.status === 'CANCELADA'}
                >
                  Sincronizar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EmitirDrawer aberto={drawerAberto} onClose={() => setDrawerAberto(false)} onEmitido={aoEmitir} />
    </div>
  );
}

// --- Drawer "Emitir documento" ---
function EmitirDrawer({ aberto, onClose, onEmitido }) {
  const toast = useToast();
  const [form, setForm] = useState({ tipo: 'NFCE', valor: '', descricao: '' });
  const [enviando, setEnviando] = useState(false);

  const fechar = () => {
    setForm({ tipo: 'NFCE', valor: '', descricao: '' });
    onClose();
  };

  const emitir = async () => {
    const valorNum = Number(form.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) return toast.error('Informe um valor valido.');
    setEnviando(true);
    try {
      const novo = await fiscalService.emitir({
        tipo: form.tipo,
        valor: valorNum,
        descricao: form.descricao || undefined,
      });
      onEmitido(novo);
      toast.success('Documento enviado para emissao.');
      fechar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao emitir.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Drawer isOpen={aberto} onClose={fechar} title="Emitir documento" description="NFC-e (loja) ou NFS-e (servico).">
      <div className="space-y-4">
        <Select
          label="Tipo"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          options={[{ value: 'NFCE', label: 'NFC-e (loja/varejo)' }, { value: 'NFSE', label: 'NFS-e (servico)' }]}
        />
        <Input
          label="Valor (R$)"
          type="number"
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
          placeholder="0,00"
        />
        <Input
          label="Descricao"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Ex: Venda #123, Consulta"
        />
        <Button variant="accent" onClick={emitir} loading={enviando} className="w-full">
          Emitir
        </Button>
      </div>
    </Drawer>
  );
}
