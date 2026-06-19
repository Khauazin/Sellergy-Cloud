import { useState, useEffect } from 'react';
import { Repeat, RefreshCw, MessageCircle, Clock, Info } from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, Select, Badge, EmptyState, useToast,
} from '../components/ui';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const soDigitos = (t) => String(t || '').replace(/\D/g, '');

const JANELAS = [
  { value: '30', label: 'Compraram ha 30+ dias' },
  { value: '45', label: 'Compraram ha 45+ dias' },
  { value: '60', label: 'Compraram ha 60+ dias' },
  { value: '90', label: 'Compraram ha 90+ dias' },
];

export default function CampanhasPage() {
  const toast = useToast();
  const [dias, setDias] = useState('30');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = async (d) => {
    setCarregando(true);
    try {
      const r = await api.get(`/campanhas/recompra?dias=${encodeURIComponent(d)}`);
      setDados(r.data);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao carregar a fila de recompra');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao montar
    carregar(dias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMudarDias = (d) => {
    setDias(d);
    carregar(d);
  };

  const candidatos = dados?.candidatos || [];

  return (
    <div className="space-y-5">
      {/* Aviso de escopo: v1 e acao manual; disparo em massa e fase 2. */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)]">
        <Info size={18} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed">
          <strong>Recompra.</strong> Clientes que compraram ha um tempo e ainda nao voltaram. Fale com eles
          pelo WhatsApp para trazer de volta. O disparo automatico em massa (com template aprovado pela Meta)
          chega em uma proxima fase.
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Repeat size={18} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">Fila de recompra</h2>
          {!carregando && <Badge variant="neutral" size="sm">{candidatos.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={dias}
            onChange={(e) => handleMudarDias(e.target.value)}
            options={JANELAS}
            placeholder=""
            fullWidth={false}
            className="w-56"
          />
          <Button variant="secondary" size="md" icon={RefreshCw} onClick={() => carregar(dias)}>Atualizar</Button>
        </div>
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : candidatos.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Repeat}
            title="Ninguem na fila de recompra"
            description="Quando clientes passarem da janela escolhida sem voltar a comprar, eles aparecem aqui."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-main)]">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cliente</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Ultima compra</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Compras</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Total gasto</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-44"></th>
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.leadId} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{c.telefone || 'Sem telefone'}</div>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                        <Clock size={13} className="text-[var(--text-muted)]" />
                        <span>{fmtData(c.ultimaCompra)}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5">ha {c.diasDesde} dias</div>
                    </td>
                    <td className="py-3 px-5 text-right text-sm text-[var(--text-secondary)] tabular-nums">{c.totalCompras}</td>
                    <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(c.valorTotal)}</td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.contatadoAposCompra && <Badge variant="success" size="sm">Ja contatado</Badge>}
                        {c.telefone ? (
                          <a href={`https://wa.me/${soDigitos(c.telefone)}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="primary" size="sm" icon={MessageCircle}>WhatsApp</Button>
                          </a>
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">sem contato</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
