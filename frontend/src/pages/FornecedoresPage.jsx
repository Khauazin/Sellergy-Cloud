import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck, Plus, Upload, Search, Pencil, Trash2, Download,
  FileText, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  Card, Button, Badge, EmptyState, Input, Textarea, Drawer, useToast, LabelAjuda,
} from '../components/ui';
import fornecedorService from '../services/fornecedorService';

const soDigitos = (s) => String(s || '').replace(/\D+/g, '');

function fmtCnpj(v) {
  const d = soDigitos(v);
  if (d.length !== 14) return v || '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function fmtTelefone(v) {
  const d = soDigitos(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || '';
}

export default function FornecedoresPage() {
  const toast = useToast();
  const [fornecedores, setFornecedores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [drawerForm, setDrawerForm] = useState(null); // null | {} (novo) | fornecedor (editar)
  const [importAberto, setImportAberto] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const lista = await fornecedorService.listar();
      setFornecedores(Array.isArray(lista) ? lista : []);
    } catch {
      toast.error('Falha ao carregar fornecedores.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return fornecedores;
    const td = soDigitos(t);
    return fornecedores.filter((f) =>
      (f.nome || '').toLowerCase().includes(t)
      || (f.email || '').toLowerCase().includes(t)
      || (td && (f.cnpj || '').includes(td))
    );
  }, [fornecedores, busca]);

  const excluir = async (f) => {
    if (!window.confirm(`Excluir o fornecedor "${f.nome}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await fornecedorService.excluir(f.id);
      setFornecedores((l) => l.filter((x) => x.id !== f.id));
      toast.success('Fornecedor excluido.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao excluir fornecedor.');
    }
  };

  const aoSalvar = (salvo, editando) => {
    setFornecedores((l) => (editando ? l.map((x) => (x.id === salvo.id ? salvo : x)) : [salvo, ...l]));
    setDrawerForm(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/app/estoque/visao-geral"
          className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]"
        >
          Estoque
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">Fornecedores</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
          Cadastro de quem fornece seus produtos. Serve de base para a entrada de notas de compra.
          Cadastre um a um ou importe varios de uma vez por planilha CSV.
        </p>
      </div>

      {/* Barra de acoes */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex-1 min-w-[220px] max-w-sm">
            <Input
              icon={Search}
              size="sm"
              placeholder="Buscar por nome, CNPJ ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={Upload} onClick={() => setImportAberto(true)}>
              Importar CSV
            </Button>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setDrawerForm({})}>
              Novo fornecedor
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista */}
      <Card padding="none">
        {carregando ? (
          <div className="text-sm text-[var(--text-muted)] py-12 text-center">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
            description={
              busca
                ? 'Ajuste a busca ou limpe o filtro para ver todos.'
                : 'Cadastre o primeiro fornecedor ou importe a sua lista por CSV.'
            }
            action={
              !busca && (
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setDrawerForm({})}>
                  Novo fornecedor
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-main)] text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Nome</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">CNPJ</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Contato</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] text-right">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {filtrados.map((f) => (
                  <tr key={f.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[var(--text-main)]">{f.nome}</div>
                      {f.observacoes && (
                        <div className="text-xs text-[var(--text-muted)] truncate max-w-[280px]">{f.observacoes}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-[var(--text-secondary)]">{fmtCnpj(f.cnpj)}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">
                      {f.email && <div className="truncate max-w-[220px]">{f.email}</div>}
                      {f.telefone && <div className="text-xs text-[var(--text-muted)] tabular-nums">{fmtTelefone(f.telefone)}</div>}
                      {!f.email && !f.telefone && <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={f.ativo ? 'success' : 'neutral'} size="sm">
                        {f.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setDrawerForm(f)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => excluir(f)} title="Excluir" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {drawerForm && (
        <FornecedorDrawer
          fornecedor={drawerForm}
          onClose={() => setDrawerForm(null)}
          aoSalvar={aoSalvar}
        />
      )}

      <ImportarCsvDrawer
        aberto={importAberto}
        onClose={() => setImportAberto(false)}
        aoImportar={carregar}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer de cadastro/edicao
// ---------------------------------------------------------------------------
function FornecedorDrawer({ fornecedor, onClose, aoSalvar }) {
  const toast = useToast();
  const editando = !!fornecedor?.id;
  const [form, setForm] = useState({
    nome: fornecedor?.nome || '',
    cnpj: fornecedor?.cnpj || '',
    email: fornecedor?.email || '',
    telefone: fornecedor?.telefone || '',
    observacoes: fornecedor?.observacoes || '',
    ativo: fornecedor?.ativo ?? true,
  });
  const [salvando, setSalvando] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const salvar = async () => {
    if (!form.nome.trim()) return toast.error('Informe o nome do fornecedor.');
    const cnpjDig = soDigitos(form.cnpj);
    if (cnpjDig && cnpjDig.length !== 14) return toast.error('CNPJ deve ter 14 digitos (ou deixe em branco).');
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome,
        cnpj: form.cnpj || null,
        email: form.email || null,
        telefone: form.telefone || null,
        observacoes: form.observacoes || null,
        ativo: form.ativo,
      };
      const salvo = editando
        ? await fornecedorService.atualizar(fornecedor.id, payload)
        : await fornecedorService.criar(payload);
      toast.success(editando ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.');
      aoSalvar(salvo, editando);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar fornecedor.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={editando ? 'Editar fornecedor' : 'Novo fornecedor'}
      description="Dados de contato e identificacao do fornecedor."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={salvar} loading={salvando}>
            {editando ? 'Salvar' : 'Cadastrar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label={<LabelAjuda texto="Nome *" ajuda="Ex.: Distribuidora Sul Ltda." />} value={form.nome} onChange={set('nome')} />
        <Input
          label={<LabelAjuda texto="CNPJ" ajuda="Opcional. Pode digitar só os números — ex.: 00.000.000/0000-00." />}
          value={form.cnpj}
          onChange={set('cnpj')}
          inputMode="numeric"
        />
        <Input label={<LabelAjuda texto="E-mail" ajuda="Ex.: contato@fornecedor.com.br." />} type="email" value={form.email} onChange={set('email')} />
        <Input label={<LabelAjuda texto="Telefone" ajuda="Com DDD — ex.: (11) 99999-0000." />} value={form.telefone} onChange={set('telefone')} inputMode="tel" />
        <Textarea label={<LabelAjuda texto="Observações" ajuda="Anotações internas sobre o fornecedor." />} value={form.observacoes} onChange={set('observacoes')} rows={3} />
        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
          />
          Fornecedor ativo
        </label>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Drawer de importacao por CSV
// ---------------------------------------------------------------------------
function baixarModelo() {
  const conteudo = 'nome;cnpj;email;telefone;observacoes\n'
    + 'Distribuidora Exemplo Ltda;12345678000190;contato@exemplo.com.br;11999990000;Fornecedor principal\n';
  // BOM pra o Excel abrir em UTF-8; o backend remove o BOM ao ler.
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-fornecedores.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ImportarCsvDrawer({ aberto, onClose, aoImportar }) {
  const toast = useToast();
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fechar = () => {
    setArquivo(null);
    setResultado(null);
    onClose();
  };

  const enviar = async () => {
    if (!arquivo) return toast.error('Escolha um arquivo .csv.');
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fornecedorService.importar(arquivo);
      setResultado(r);
      if (r.criados > 0) {
        toast.success(`${r.criados} fornecedor(es) importado(s).`);
        aoImportar();
      }
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao importar CSV.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Drawer
      isOpen={aberto}
      onClose={fechar}
      title="Importar fornecedores (CSV)"
      description="Envie uma planilha com os fornecedores. O arquivo e validado antes de salvar."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={fechar}>Fechar</Button>
          <Button variant="primary" onClick={enviar} loading={enviando} disabled={!arquivo} icon={Upload}>
            Importar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] p-4">
          <div className="flex items-start gap-3">
            <FileText size={18} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-main)]">Como montar a planilha</p>
              <p className="mt-1 text-[var(--text-muted)]">
                Colunas: <strong>nome</strong> (obrigatoria), <code>cnpj</code>, <code>email</code>,
                {' '}<code>telefone</code>, <code>observacoes</code>. Separador <code>;</code> ou <code>,</code>.
                Linhas com erro sao puladas e listadas no fim.
              </p>
              <button
                type="button"
                onClick={baixarModelo}
                className="mt-2 inline-flex items-center gap-1.5 text-[var(--primary)] font-semibold hover:underline"
              >
                <Download size={14} /> Baixar modelo
              </button>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">Arquivo CSV</span>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-4 cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors">
            <Upload size={18} className="text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)] truncate">
              {arquivo ? arquivo.name : 'Clique para escolher um arquivo .csv (ate 2MB)'}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { setArquivo(e.target.files?.[0] || null); setResultado(null); }}
            />
          </div>
        </label>

        {resultado && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" size="sm">
                <CheckCircle2 size={12} className="mr-1" /> {resultado.criados} importado(s)
              </Badge>
              {resultado.ignorados > 0 && (
                <Badge variant="warning" size="sm">
                  <AlertTriangle size={12} className="mr-1" /> {resultado.ignorados} ignorado(s)
                </Badge>
              )}
              <span className="text-xs text-[var(--text-muted)]">de {resultado.total} linha(s)</span>
            </div>

            {Array.isArray(resultado.detalhes) && resultado.detalhes.length > 0 && (
              <div className="rounded-xl border border-[var(--border-main)] divide-y divide-[var(--border-main)] max-h-56 overflow-y-auto">
                {resultado.detalhes.map((d, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="text-[var(--text-muted)]">
                      {d.linha ? `Linha ${d.linha}` : 'Registro'}
                    </span>
                    <span className="text-[var(--text-secondary)] text-right">{d.motivo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
