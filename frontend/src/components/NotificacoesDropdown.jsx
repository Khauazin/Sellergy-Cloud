// =====================================================================
// Sino de notificações + dropdown
// =====================================================================
// Substitui o IconButton solto do Topbar. Faz polling de 30 em 30 segundos
// para atualizar contagem e itens. Ao clicar numa notificação, marca como
// lida e navega para o `link` interno (se houver). Tem botão "Marcar
// todas como lidas".
//
// Acessibilidade: o sino é um botão real, o dropdown fecha ao clicar fora
// e ao pressionar Esc.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import clsx from 'clsx';
import notificacaoService from '../services/notificacaoService';
import { useAuthStore } from '../store/auth.store';

const INTERVALO_POLL_MS = 30_000;

// Calcula "há X minutos" / "há X horas" / "ontem" sem dependência externa.
function tempoRelativo(dataIso) {
  const diff = (Date.now() - new Date(dataIso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ontem';
  return `há ${Math.floor(diff / 86400)} dias`;
}

export default function NotificacoesDropdown() {
  // Notificacao e um recurso do tenant: toda consulta do backend filtra por
  // `clienteId`. O administrador do sistema nao tem tenant, entao nao existe
  // notificacao para ele — a API responde 403, e esta certa em responder.
  // Como o Topbar e compartilhado pelos dois layouts, o sino aparecia tambem no
  // admin e ficava consultando a cada 30 segundos, enchendo o console de erro.
  const semTenant = useAuthStore((s) => !s.user?.clienteId);
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const buscar = async () => {
    try {
      const r = await notificacaoService.listar({ limite: 15 });
      setItens(r.itens || []);
      setTotalNaoLidas(r.totalNaoLidas || 0);
    } catch {
      // Falha silenciosa: o sino pode ficar sem badge, mas não bloqueia o app.
    }
  };

  // Polling. Limpa intervalo quando o componente sair de tela.
  useEffect(() => {
    if (semTenant) return undefined;
    buscar();
    const id = setInterval(buscar, INTERVALO_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semTenant]);

  // Fecha ao clicar fora ou ao apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const onClickItem = async (n) => {
    setAberto(false);
    // Otimista: já marca lida localmente antes da resposta do backend.
    if (!n.lida) {
      setItens((arr) => arr.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      setTotalNaoLidas((t) => Math.max(0, t - 1));
      notificacaoService.marcarLida(n.id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const onMarcarTodas = async (e) => {
    e.stopPropagation();
    if (totalNaoLidas === 0) return;
    setCarregando(true);
    try {
      await notificacaoService.marcarTodasLidas();
      setItens((arr) => arr.map((x) => ({ ...x, lida: true })));
      setTotalNaoLidas(0);
    } finally {
      setCarregando(false);
    }
  };

  // Depois dos hooks (a ordem deles nao pode variar entre renderizacoes): um
  // sino que nunca teria conteudo so confunde, entao nem aparece para o admin.
  if (semTenant) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${totalNaoLidas > 0 ? `, ${totalNaoLidas} não lidas` : ''}`}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] transition-colors"
      >
        <Bell size={18} strokeWidth={1.75} />
        {totalNaoLidas > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--danger)] text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-[360px] max-h-[480px] bg-[var(--bg-elevated)] border border-[var(--border-main)] rounded-xl shadow-[var(--shadow-lg)] z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-main)]">
            <div>
              <div className="text-sm font-semibold text-[var(--text-main)]">Notificações</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {totalNaoLidas > 0 ? `${totalNaoLidas} não lida(s)` : 'Tudo em dia'}
              </div>
            </div>
            {totalNaoLidas > 0 && (
              <button
                type="button"
                onClick={onMarcarTodas}
                disabled={carregando}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline disabled:opacity-50"
              >
                <CheckCheck size={12} /> Marcar todas
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Inbox size={28} className="text-[var(--text-muted)] opacity-50" strokeWidth={1.5} />
                <div className="text-sm text-[var(--text-secondary)] mt-3">Sem notificações por aqui</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1">Você fica sabendo quando algo importante acontecer.</div>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {itens.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onClickItem(n)}
                      className={clsx(
                        'w-full text-left px-4 py-3 hover:bg-[var(--bg-subtle)]/60 transition-colors flex gap-3',
                        !n.lida && 'bg-[var(--accent-soft)]/30'
                      )}
                    >
                      <span className={clsx(
                        'flex-shrink-0 w-2 h-2 rounded-full mt-2',
                        n.lida ? 'bg-transparent' : 'bg-[var(--accent)]'
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--text-main)] truncate">{n.titulo}</div>
                        <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{n.mensagem}</div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1">{tempoRelativo(n.criadoEm)}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
