import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const TAMANHO_MAX_BYTES = 5 * 1024 * 1024;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Componente reusavel de upload de imagem.
 *
 * Props:
 *  - imagemUrl: string|null — URL atual (mostra preview)
 *  - onUpload(file): Promise<string> — sobe pro backend, devolve URL nova
 *  - onRemover(): Promise<void> — remove no backend
 *  - tamanho: 'sm' | 'md' | 'lg' (default md)
 *  - desabilitado: boolean
 *
 * Validacoes client-side: tipo MIME e tamanho. Backend revalida.
 */
export default function UploadImagem({
  imagemUrl,
  onUpload,
  onRemover,
  tamanho = 'md',
  desabilitado = false,
  className,
}) {
  const inputRef = useRef(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const sizes = {
    sm: 'w-24 h-24',
    md: 'w-40 h-40',
    lg: 'w-56 h-56',
  };

  const validar = (file) => {
    if (!file) return 'Selecione um arquivo.';
    if (!TIPOS_ACEITOS.includes(file.type)) {
      return `Tipo nao suportado: ${file.type}. Use JPG, PNG ou WEBP.`;
    }
    if (file.size > TAMANHO_MAX_BYTES) {
      return `Arquivo excede ${TAMANHO_MAX_BYTES / 1024 / 1024}MB.`;
    }
    return null;
  };

  const enviar = async (file) => {
    setErro(null);
    const erroValid = validar(file);
    if (erroValid) {
      setErro(erroValid);
      return;
    }
    setEnviando(true);
    try {
      await onUpload(file);
    } catch (e) {
      setErro(e?.response?.data?.erro || e?.message || 'Falha no upload.');
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onChangeFile = (e) => {
    const file = e.target.files?.[0];
    if (file) enviar(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setArrastando(false);
    if (desabilitado) return;
    const file = e.dataTransfer.files?.[0];
    if (file) enviar(file);
  };

  const onClickArea = () => {
    if (desabilitado || enviando) return;
    inputRef.current?.click();
  };

  const remover = async () => {
    if (!onRemover || desabilitado || enviando) return;
    if (!window.confirm('Remover a imagem?')) return;
    setEnviando(true);
    setErro(null);
    try {
      await onRemover();
    } catch (e) {
      setErro(e?.response?.data?.erro || e?.message || 'Falha ao remover.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={clsx('inline-block', className)}>
      <div
        onClick={onClickArea}
        onDragOver={(e) => { e.preventDefault(); if (!desabilitado) setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
        className={clsx(
          'relative rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-colors',
          sizes[tamanho],
          arrastando
            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
            : 'border-[var(--border-strong)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-card)]',
          desabilitado && 'opacity-40 cursor-not-allowed'
        )}
      >
        {imagemUrl && !enviando ? (
          <img src={imagemUrl} alt="" className="w-full h-full object-cover" />
        ) : enviando ? (
          <Loader2 size={20} className="animate-spin text-[var(--text-muted)]" />
        ) : (
          <div className="text-center text-[var(--text-muted)] px-2">
            <ImagePlus size={20} className="mx-auto opacity-60" />
            <div className="text-[10px] font-semibold mt-1">Adicionar imagem</div>
            <div className="text-[9px] mt-0.5 opacity-80">JPG/PNG/WEBP, max 5MB</div>
          </div>
        )}
        {imagemUrl && !enviando && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remover(); }}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-[var(--danger)] text-white opacity-0 hover:opacity-100 transition-opacity"
            title="Remover imagem"
            aria-label="Remover imagem"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_ACEITOS.join(',')}
        className="hidden"
        onChange={onChangeFile}
      />
      {erro && (
        <div className="text-[11px] text-[var(--danger-text)] mt-1.5 max-w-[200px] leading-snug">
          {erro}
        </div>
      )}
    </div>
  );
}
