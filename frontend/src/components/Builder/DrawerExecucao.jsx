import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { Drawer, Badge } from '../ui';
import api from '../../services/api';
import { configDoTipo } from './catalogoNos';

const STATUS_VARIANT = {
  PENDENTE: 'neutral',
  EM_EXECUCAO: 'info',
  SUCESSO: 'success',
  ERRO: 'danger',
  CANCELADA: 'warning',
};

const STATUS_FINAIS = new Set(['SUCESSO', 'ERRO', 'CANCELADA']);
const INTERVALO_POLL_MS = 1000;

export default function DrawerExecucao({ execucaoId, isOpen, onClose }) {
  const [execucao, setExecucao] = useState(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!isOpen || !execucaoId) return;
    let ativo = true;
    let timer;

    const buscar = async () => {
      if (!ativo) return;
      try {
        const r = await api.get(`/execucoes/${execucaoId}`);
        if (!ativo) return;
        setExecucao(r.data);
        if (!STATUS_FINAIS.has(r.data?.status)) {
          timer = setTimeout(buscar, INTERVALO_POLL_MS);
        }
      } catch {
        if (ativo) setExecucao(null);
      } finally {
        if (ativo) setCarregando(false);
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- polling on open
    setCarregando(true);
    setExecucao(null);
    buscar();
    return () => {
      ativo = false;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, execucaoId]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Logs de execucao"
      description={
        execucao
          ? `#${execucao.id.slice(0, 8)} · ${formatarData(execucao.iniciadaEm)}`
          : 'Detalhes da ultima execucao'
      }
      size="lg"
    >
      {carregando && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 size={14} className="animate-spin" /> Carregando...
        </div>
      )}
      {!carregando && !execucao && (
        <p className="text-sm text-[var(--text-muted)]">Sem dados.</p>
      )}
      {!carregando && execucao && <ConteudoExecucao execucao={execucao} />}
    </Drawer>
  );
}

function ConteudoExecucao({ execucao }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-main)]">
        <Badge variant={STATUS_VARIANT[execucao.status] || 'neutral'}>{execucao.status}</Badge>
        <span className="text-xs text-[var(--text-muted)]">
          {typeof execucao.duracaoMs === 'number' ? `${execucao.duracaoMs}ms` : '—'}
        </span>
        <span className="text-xs text-[var(--text-muted)]">·</span>
        <span className="text-xs text-[var(--text-muted)]">{execucao.modo}</span>
        {execucao.iniciadaPor?.nome && (
          <>
            <span className="text-xs text-[var(--text-muted)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">por {execucao.iniciadaPor.nome}</span>
          </>
        )}
      </div>

      {execucao.erro && (
        <div className="text-xs text-[var(--danger-text)] bg-[var(--danger-soft)] rounded-lg p-3 font-mono break-words">
          {execucao.erro}
        </div>
      )}

      {execucao.nos?.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum no foi processado.</p>
      ) : (
        <div className="space-y-2">
          {execucao.nos.map((no) => (
            <CardNoExecutado key={no.id} no={no} />
          ))}
        </div>
      )}
    </div>
  );
}

function CardNoExecutado({ no }) {
  const [aberto, setAberto] = useState(no.status === 'ERRO');
  const cfg = configDoTipo(no.tipo);
  const Icone = cfg?.icone;
  const StatusIcone = no.status === 'SUCESSO' ? CheckCircle2 : no.status === 'ERRO' ? XCircle : Loader2;

  return (
    <div className="rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left"
      >
        {aberto ? (
          <ChevronDown size={14} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronRight size={14} className="text-[var(--text-muted)]" />
        )}
        {Icone && (
          <div className="w-7 h-7 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
            <Icone size={14} strokeWidth={1.75} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[var(--text-main)] tracking-tight truncate">
            {cfg?.rotulo || no.tipo}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate">
            {no.noId} · {typeof no.duracaoMs === 'number' ? `${no.duracaoMs}ms` : '—'}
          </div>
        </div>
        <StatusIcone
          size={16}
          className={clsx(
            no.status === 'SUCESSO' && 'text-[var(--success)]',
            no.status === 'ERRO' && 'text-[var(--danger)]',
            no.status === 'EM_EXECUCAO' && 'text-[var(--text-muted)] animate-spin'
          )}
        />
      </button>

      {aberto && (
        <div className="border-t border-[var(--border-main)] px-3 py-3 space-y-2 text-xs">
          {no.erro && (
            <BlocoJson titulo="Erro" valor={no.erro} variante="danger" />
          )}
          {no.entrada !== undefined && no.entrada !== null && (
            <BlocoJson titulo="Entrada" valor={no.entrada} />
          )}
          {no.saida !== undefined && no.saida !== null && (
            <BlocoJson titulo="Saida" valor={no.saida} />
          )}
        </div>
      )}
    </div>
  );
}

function BlocoJson({ titulo, valor, variante }) {
  let texto = '';
  try {
    texto = typeof valor === 'string' ? valor : JSON.stringify(valor, null, 2);
  } catch {
    texto = String(valor);
  }
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {titulo}
      </div>
      <pre
        className={clsx(
          'text-[11px] font-mono whitespace-pre-wrap break-words rounded-lg p-2.5 max-h-72 overflow-auto',
          variante === 'danger'
            ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
            : 'bg-[var(--bg-subtle)] text-[var(--text-main)]'
        )}
      >
        {texto}
      </pre>
    </div>
  );
}

function formatarData(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  } catch {
    return '';
  }
}
