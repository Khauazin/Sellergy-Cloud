import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, BookOpen } from 'lucide-react';
import clsx from 'clsx';
import { Drawer, useToast } from '../ui';

const URL_MANUAL = '/manual_bot_atendimento.md';
const CHAVE_PROGRESSO = 'sellergy:manual:progresso:v1';

// Slug determinístico pra usar como id de seção (TOC + scrollspy).
function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Achata os children do react-markdown em string pura (pra slug do heading).
function textoDeChildren(children) {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(textoDeChildren).join('');
  if (children?.props?.children) return textoDeChildren(children.props.children);
  return '';
}

// Extrai TOC do markdown bruto (## e ###). Não depende do react-markdown
// porque a gente precisa montar a sidebar antes do render do conteúdo.
function extrairToc(markdown) {
  const linhas = (markdown || '').split('\n');
  let dentroDeBloco = false;
  const itens = [];
  for (const linha of linhas) {
    if (linha.startsWith('```')) { dentroDeBloco = !dentroDeBloco; continue; }
    if (dentroDeBloco) continue;
    const m2 = linha.match(/^##\s+(.+?)\s*$/);
    if (m2) { itens.push({ nivel: 2, texto: m2[1], slug: slugify(m2[1]) }); continue; }
    const m3 = linha.match(/^###\s+(.+?)\s*$/);
    if (m3) { itens.push({ nivel: 3, texto: m3[1], slug: slugify(m3[1]) }); continue; }
  }
  return itens;
}

// Conta total de checkboxes (`- [ ]` ou `- [x]`) no markdown — pra mostrar progresso.
function contarCheckboxes(markdown) {
  const re = /^\s*[-*]\s+\[[ xX]\]\s/gm;
  return (markdown.match(re) || []).length;
}

export default function DrawerManual({ isOpen, onClose }) {
  const toast = useToast();
  const [markdown, setMarkdown] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [progresso, setProgresso] = useState(() => {
    try {
      const raw = localStorage.getItem(CHAVE_PROGRESSO);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [secaoAtiva, setSecaoAtiva] = useState(null);
  const conteudoRef = useRef(null);

  // Carrega o markdown sob demanda (1x ao abrir).
  useEffect(() => {
    if (!isOpen || markdown) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    fetch(URL_MANUAL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((texto) => { if (ativo) setMarkdown(texto); })
      .catch((e) => { if (ativo) setErro(e.message || 'falha ao carregar'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [isOpen, markdown]);

  const toc = useMemo(() => extrairToc(markdown), [markdown]);
  const totalCheckboxes = useMemo(() => contarCheckboxes(markdown), [markdown]);
  const concluidos = useMemo(
    () => Object.values(progresso).filter(Boolean).length,
    [progresso]
  );

  const persistir = useCallback((novo) => {
    setProgresso(novo);
    try { localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify(novo)); }
    catch { /* localStorage cheio/bloqueado */ }
  }, []);

  const togglePasso = useCallback((id) => {
    persistir({ ...progresso, [id]: !progresso[id] });
  }, [progresso, persistir]);

  const resetarProgresso = useCallback(() => {
    if (!window.confirm('Resetar todo o progresso do manual?')) return;
    persistir({});
  }, [persistir]);

  // Scrollspy: detecta qual seção está visível conforme o usuário rola.
  useEffect(() => {
    if (!isOpen || !conteudoRef.current || toc.length === 0) return;
    const root = conteudoRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visiveis = entries.filter((e) => e.isIntersecting);
        if (visiveis.length === 0) return;
        // pega o primeiro visível (mais perto do topo)
        const ordenado = visiveis.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
        );
        setSecaoAtiva(ordenado[0].target.id);
      },
      { root, rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );
    const headers = root.querySelectorAll('h2[id], h3[id]');
    headers.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [isOpen, toc, markdown]);

  const irPara = useCallback((slug) => {
    const el = conteudoRef.current?.querySelector(`#${CSS.escape(slug)}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const componentes = useMemo(() => criarComponentes(toast, progresso, togglePasso), [toast, progresso, togglePasso]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="xl" title={
      <div className="flex items-center gap-2">
        <BookOpen size={18} className="text-[var(--accent)]" />
        <span>Manual do Bot</span>
      </div>
    }>
      <div className="flex h-full overflow-hidden">
        {/* SIDEBAR TOC */}
        <aside className="w-64 flex-shrink-0 border-r border-[var(--border-main)] bg-[var(--bg-subtle)] overflow-y-auto">
          <div className="px-4 py-3 border-b border-[var(--border-main)] sticky top-0 bg-[var(--bg-subtle)] z-10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Progresso
              </span>
              <button
                type="button"
                onClick={resetarProgresso}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
              >
                resetar
              </button>
            </div>
            <BarraProgresso atual={concluidos} total={totalCheckboxes} />
            <div className="text-[11px] text-[var(--text-muted)] mt-1">
              {concluidos} de {totalCheckboxes} passos concluídos
            </div>
          </div>
          <nav className="px-2 py-2">
            {toc.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() => irPara(item.slug)}
                className={clsx(
                  'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors block',
                  item.nivel === 3 && 'pl-5 text-[11px]',
                  secaoAtiva === item.slug
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'
                )}
              >
                {item.texto}
              </button>
            ))}
          </nav>
        </aside>

        {/* CONTEÚDO */}
        <div ref={conteudoRef} className="flex-1 overflow-y-auto px-8 py-6 manual-conteudo">
          {carregando && (
            <div className="text-sm text-[var(--text-muted)]">Carregando manual…</div>
          )}
          {erro && (
            <div className="text-sm text-[var(--danger)]">
              Erro ao carregar manual: {erro}
            </div>
          )}
          {markdown && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
              {markdown}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function BarraProgresso({ atual, total }) {
  const pct = total === 0 ? 0 : Math.round((atual / total) * 100);
  return (
    <div className="h-1.5 w-full bg-[var(--border-main)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[var(--accent)] transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// =====================================================================
// Componentes do react-markdown (renderiza headings, code, listas, etc.)
// =====================================================================
function criarComponentes(toast, progresso, togglePasso) {
  const idCheckboxRef = { atual: 0 };

  const Cabecalho = (level) => function Hx({ children }) {
    const texto = textoDeChildren(children);
    const id = slugify(texto);
    const classes = {
      1: 'text-2xl font-bold text-[var(--text-main)] mt-8 mb-4 pb-2 border-b border-[var(--border-main)]',
      2: 'text-xl font-bold text-[var(--text-main)] mt-8 mb-3 pb-2 border-b border-[var(--border-main)] scroll-mt-4',
      3: 'text-lg font-semibold text-[var(--text-main)] mt-6 mb-2 scroll-mt-4',
      4: 'text-base font-semibold text-[var(--text-main)] mt-4 mb-2',
    };
    const Tag = `h${level}`;
    return <Tag id={id} className={classes[level]}>{children}</Tag>;
  };

  return {
    h1: Cabecalho(1),
    h2: Cabecalho(2),
    h3: Cabecalho(3),
    h4: Cabecalho(4),
    p: ({ children }) => (
      <p className="text-sm leading-relaxed text-[var(--text-secondary)] my-3">{children}</p>
    ),
    a: ({ href, children }) => {
      const interno = href?.startsWith('#');
      return (
        <a
          href={href}
          target={interno ? undefined : '_blank'}
          rel={interno ? undefined : 'noreferrer'}
          className="text-[var(--accent)] hover:underline"
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="my-3 space-y-1.5 text-sm text-[var(--text-secondary)]">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 space-y-1.5 list-decimal list-inside text-sm text-[var(--text-secondary)]">{children}</ol>
    ),
    li: ({ children, checked }) => {
      // Suporte a `- [ ]` / `- [x]` via remark-gfm: o `checked` chega como bool.
      if (typeof checked === 'boolean') {
        const id = `chk-${idCheckboxRef.atual++}`;
        const marcado = !!progresso[id];
        return (
          <li className="flex items-start gap-2 list-none -ml-4">
            <button
              type="button"
              onClick={() => togglePasso(id)}
              className={clsx(
                'flex-shrink-0 w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors',
                marcado
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                  : 'bg-[var(--bg-card)] border-[var(--border-strong)] hover:border-[var(--accent)]'
              )}
              aria-label="Marcar como concluído"
            >
              {marcado && <Check size={11} strokeWidth={3} />}
            </button>
            <span className={clsx(marcado && 'line-through text-[var(--text-muted)]')}>
              {filtrarChildrenDeCheckbox(children)}
            </span>
          </li>
        );
      }
      return <li className="ml-5 list-disc marker:text-[var(--text-muted)]">{children}</li>;
    },
    code: ({ inline, className, children }) => {
      // react-markdown 10: inline = !node.position?.start.line === node.position?.end.line
      // mas o reliable é checar className (blocos têm "language-xxx").
      const isBloco = className?.startsWith('language-') || (!inline && String(children).includes('\n'));
      const texto = String(children).replace(/\n$/, '');
      if (!isBloco) {
        return (
          <code className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[12px] font-mono text-[var(--text-main)]">
            {children}
          </code>
        );
      }
      return <BlocoCodigo texto={texto} linguagem={className?.replace('language-', '')} toast={toast} />;
    },
    pre: ({ children }) => <>{children}</>, // o `code` cuida do bloco
    blockquote: ({ children }) => (
      <blockquote className="my-3 pl-4 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)]/30 py-2 pr-3 rounded-r text-sm text-[var(--text-secondary)] italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-[var(--border-main)]">
        <table className="w-full text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-main)]">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold text-[var(--text-main)] uppercase tracking-wider text-[10px]">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-[var(--text-secondary)] align-top border-t border-[var(--border-main)]">
        {children}
      </td>
    ),
    hr: () => <hr className="my-6 border-[var(--border-main)]" />,
    strong: ({ children }) => <strong className="font-semibold text-[var(--text-main)]">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
  };
}

// Quando o item da lista é checkbox, o remark-gfm injeta um <input> antes do texto.
// Como já renderizamos nosso próprio botão, removemos o input pra não duplicar.
function filtrarChildrenDeCheckbox(children) {
  if (!Array.isArray(children)) return children;
  return children.filter((c) => {
    if (typeof c === 'object' && c?.type === 'input') return false;
    return true;
  });
}

function BlocoCodigo({ texto, linguagem, toast }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      toast?.success?.('Copiado!');
      setTimeout(() => setCopiado(false), 1500);
    }).catch(() => {
      toast?.error?.('Falha ao copiar');
    });
  };
  return (
    <div className="my-3 relative group">
      {linguagem && (
        <div className="absolute top-2 right-12 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-mono">
          {linguagem}
        </div>
      )}
      <button
        type="button"
        onClick={copiar}
        className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
      >
        {copiado ? <Check size={11} /> : <Copy size={11} />}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
      <pre className="px-4 py-3 rounded-lg bg-[var(--bg-deep)] border border-[var(--border-main)] overflow-x-auto text-[12px] font-mono leading-relaxed text-[var(--text-main)]">
        <code>{texto}</code>
      </pre>
    </div>
  );
}
