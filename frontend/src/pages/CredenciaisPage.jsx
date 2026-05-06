import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Key, Plus, Trash2, Pencil, Lock, ArrowLeft, Sparkles, Globe, MessageCircle, Send,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Badge, EmptyState,
  Input, Select, Textarea, Drawer, useToast,
} from '../components/ui';
import credenciaisService from '../services/credenciaisService';

const ROTULOS_TIPO = {
  OPENAI_API_KEY: { rotulo: 'OpenAI', cor: 'accent', categoria: 'IA', icone: Sparkles },
  ANTHROPIC_API_KEY: { rotulo: 'Anthropic Claude', cor: 'accent', categoria: 'IA', icone: Sparkles },
  GEMINI_API_KEY: { rotulo: 'Google Gemini', cor: 'accent', categoria: 'IA', icone: Sparkles },
  WHATSAPP_CLOUD_TOKEN: { rotulo: 'WhatsApp Cloud API', cor: 'success', categoria: 'Canal', icone: MessageCircle },
  TELEGRAM_BOT_TOKEN: { rotulo: 'Telegram Bot', cor: 'info', categoria: 'Canal', icone: Send },
  HTTP_BEARER: { rotulo: 'HTTP Bearer Token', cor: 'neutral', categoria: 'HTTP', icone: Globe },
  HTTP_BASIC: { rotulo: 'HTTP Basic (usuario/senha)', cor: 'neutral', categoria: 'HTTP', icone: Globe },
  HTTP_API_KEY: { rotulo: 'HTTP API Key (header customizado)', cor: 'neutral', categoria: 'HTTP', icone: Globe },
  OUTRO: { rotulo: 'Outro', cor: 'neutral', categoria: 'Outro', icone: Key },
};

export default function CredenciaisPage() {
  const toast = useToast();
  const [credenciais, setCredenciais] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [drawer, setDrawer] = useState({ aberto: false, credencial: null });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [t, c] = await Promise.all([
        credenciaisService.listarTipos().catch(() => []),
        credenciaisService.listar().catch(() => []),
      ]);
      setTipos(t);
      setCredenciais(c);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  const excluir = async (cred) => {
    if (!window.confirm(`Excluir credencial "${cred.nome}"? Fluxos que dependem dela vao falhar.`)) return;
    try {
      await credenciaisService.excluir(cred.id);
      toast.success('Credencial excluida.');
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao excluir.');
    }
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div>
        <Link to="/app/configuracoes" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
          <ArrowLeft size={12} /> Voltar para configuracoes
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">Credenciais</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Chaves de API e tokens cifrados em repouso. Cada credencial fica vinculada ao seu cliente.
          Admin do sistema nao tem acesso ao conteudo.
        </p>
      </div>

      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>{credenciais.length} {credenciais.length === 1 ? 'credencial cadastrada' : 'credenciais cadastradas'}</CardTitle>
            <CardDescription>
              <span className="inline-flex items-center gap-1.5"><Lock size={11} /> AES-256-GCM com chave derivada por tenant.</span>
            </CardDescription>
          </div>
          <Button variant="accent" icon={Plus} onClick={() => setDrawer({ aberto: true, credencial: null })}>
            Nova credencial
          </Button>
        </CardHeader>

        {carregando ? (
          <div className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando...</div>
        ) : credenciais.length === 0 ? (
          <EmptyState
            icon={Key}
            title="Nenhuma credencial"
            description="Adicione chaves de API para que os bots possam usar OpenAI, WhatsApp, etc."
            action={
              <Button variant="accent" icon={Plus} onClick={() => setDrawer({ aberto: true, credencial: null })}>
                Cadastrar primeira
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {credenciais.map((c) => {
              const cfg = ROTULOS_TIPO[c.tipo] || ROTULOS_TIPO.OUTRO;
              const Icone = cfg.icone;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
                    <Icone size={16} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</span>
                      <Badge variant={cfg.cor} size="sm">{cfg.rotulo}</Badge>
                    </div>
                    {c.descricao && (
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{c.descricao}</div>
                    )}
                    <div className="text-[10px] text-[var(--text-muted)] mt-1">
                      Criada {new Date(c.criadoEm).toLocaleDateString('pt-BR')}
                      {c.ultimoUsoEm ? ` · ultimo uso ${new Date(c.ultimoUsoEm).toLocaleDateString('pt-BR')}` : ' · nunca usada'}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setDrawer({ aberto: true, credencial: c })}>
                    Editar
                  </Button>
                  <Button variant="danger-soft" size="sm" icon={Trash2} onClick={() => excluir(c)}>
                    Excluir
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <DrawerCredencial
        isOpen={drawer.aberto}
        credencial={drawer.credencial}
        tipos={tipos}
        onClose={() => setDrawer({ aberto: false, credencial: null })}
        onSalvo={() => {
          setDrawer({ aberto: false, credencial: null });
          carregar();
        }}
      />
    </div>
  );
}

function DrawerCredencial({ isOpen, credencial, tipos, onClose, onSalvo }) {
  const toast = useToast();
  const ehEdicao = !!credencial;
  const [form, setForm] = useState({ nome: '', tipo: 'OPENAI_API_KEY', descricao: '', dados: {} });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (credencial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill on open
      setForm({
        nome: credencial.nome,
        tipo: credencial.tipo,
        descricao: credencial.descricao || '',
        dados: {}, // edicao nao traz segredos antigos — usuario pode preencher pra trocar
      });
    } else {
      setForm({ nome: '', tipo: 'OPENAI_API_KEY', descricao: '', dados: {} });
    }
  }, [isOpen, credencial]);

  const schemaAtual = useMemo(() => {
    return tipos.find((t) => t.tipo === form.tipo)?.schema || { obrigatorios: [], opcionais: [] };
  }, [tipos, form.tipo]);

  const setCampo = (chave, valor) => {
    setForm((f) => ({ ...f, dados: { ...f.dados, [chave]: valor } }));
  };

  const salvar = async () => {
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      toast.error('Nome obrigatorio (minimo 2 caracteres).');
      return;
    }

    // Em criacao: todos os obrigatorios precisam vir.
    // Em edicao: dados eh opcional (so envia se usuario preencheu).
    const dadosTemAlgo = Object.values(form.dados).some((v) => v && String(v).trim());
    if (!ehEdicao || dadosTemAlgo) {
      for (const campo of schemaAtual.obrigatorios) {
        const v = form.dados[campo];
        if (!v || !String(v).trim()) {
          toast.error(`Campo obrigatorio: ${campo}`);
          return;
        }
      }
    }

    setSalvando(true);
    try {
      if (ehEdicao) {
        await credenciaisService.atualizar(credencial.id, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          ...(dadosTemAlgo ? { dados: form.dados } : {}),
        });
        toast.success('Credencial atualizada.');
      } else {
        await credenciaisService.criar({
          nome: form.nome.trim(),
          tipo: form.tipo,
          descricao: form.descricao.trim() || null,
          dados: form.dados,
        });
        toast.success('Credencial criada e cifrada.');
      }
      onSalvo();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar credencial.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={ehEdicao ? `Editar ${credencial?.nome}` : 'Nova credencial'}
      description={ehEdicao
        ? 'Em edicao os campos secretos NAO sao retornados. Preencha apenas se quiser substituir.'
        : 'Os dados sao cifrados antes de chegar ao banco.'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" onClick={salvar} loading={salvando}>
            {ehEdicao ? 'Salvar alteracoes' : 'Criar credencial'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nome"
          autoFocus
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="ex.: Conta principal OpenAI"
          maxLength={120}
        />

        <Select
          label="Tipo"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value, dados: {} })}
          disabled={ehEdicao}
          options={tipos.map((t) => ({
            value: t.tipo,
            label: ROTULOS_TIPO[t.tipo]?.rotulo || t.tipo,
          }))}
          placeholder=""
          hint={ehEdicao ? 'Tipo nao pode ser alterado apos criado.' : undefined}
        />

        <Textarea
          label="Descricao (opcional)"
          rows={2}
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Anote aqui pra que serve, conta vinculada, etc."
          maxLength={500}
        />

        {/* Campos especificos do tipo */}
        <div className="border-t border-[var(--border-main)] pt-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Dados secretos {ehEdicao && '(deixe em branco para manter os atuais)'}
          </div>
          {schemaAtual.obrigatorios.map((campo) => (
            <Input
              key={campo}
              label={`${campo} *`}
              type={campoEhSecreto(campo) ? 'password' : 'text'}
              value={form.dados[campo] || ''}
              onChange={(e) => setCampo(campo, e.target.value)}
              autoComplete="off"
            />
          ))}
          {schemaAtual.opcionais.map((campo) => (
            <Input
              key={campo}
              label={`${campo} (opcional)`}
              type={campoEhSecreto(campo) ? 'password' : 'text'}
              value={form.dados[campo] || ''}
              onChange={(e) => setCampo(campo, e.target.value)}
              autoComplete="off"
            />
          ))}
          {schemaAtual.obrigatorios.length === 0 && schemaAtual.opcionais.length === 0 && (
            <p className="text-xs text-[var(--text-muted)]">Tipo "OUTRO" nao tem campos pre-definidos.</p>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// Heuristica para mascarar campos sensiveis (apiKey, token, senha, key).
function campoEhSecreto(nome) {
  const n = nome.toLowerCase();
  return n.includes('key') || n.includes('token') || n.includes('senha') || n.includes('secret');
}
