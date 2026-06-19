// Página de detalhe do snapshot mensal. Lê o JSON salvo no backend e
// renderiza um resumo executivo: financeiro, caixa, vendas, CRM.

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, DollarSign, ShoppingBag, Wallet, Users, AlertCircle } from 'lucide-react';
import { Card, Badge, KpiCard, Button, BotaoExportar } from '../components/ui';
import relatorioMensalService from '../services/relatorioMensalService';

const NOMES_MES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => Number(v ?? 0).toLocaleString('pt-BR');
const fmtPct = (v) => `${Number(v ?? 0).toFixed(1)}%`;

export default function RelatorioMensalDetalhePage() {
  const { periodo } = useParams(); // formato "YYYY-MM"
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Parse seguro do segmento da URL.
  const [anoStr, mesStr] = (periodo || '').split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const periodoValido = Number.isInteger(ano) && Number.isInteger(mes) && mes >= 1 && mes <= 12;

  useEffect(() => {
    if (!periodoValido) {
      setErro('Endereço inválido.');
      setCarregando(false);
      return;
    }
    relatorioMensalService.detalhe(ano, mes)
      .then((r) => setDados(r))
      .catch((e) => setErro(e?.response?.data?.error || 'Não foi possível carregar este relatório.'))
      .finally(() => setCarregando(false));
  }, [ano, mes, periodoValido]);

  if (carregando) {
    return (
      <div className="space-y-4">
        <Card padding="lg"><div className="text-sm text-[var(--text-muted)] text-center py-6">Carregando…</div></Card>
      </div>
    );
  }

  if (erro || !dados) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/app/relatorios/mensais')}>
          Voltar
        </Button>
        <Card padding="lg">
          <div className="text-sm text-center py-6 text-[var(--text-secondary)]">
            <AlertCircle size={20} className="mx-auto text-[var(--text-muted)] mb-2" />
            <div className="font-semibold text-[var(--text-main)]">{erro || 'Sem dados'}</div>
            <div className="text-[var(--text-muted)] mt-1">
              Este mês ainda não tem fechamento gerado. Você pode disparar manualmente em <Link to="/app/relatorios/mensais" className="text-[var(--accent)] hover:underline">Fechamento mensal</Link>.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const snap = dados.dados || {};
  const fin = snap.financeiro || {};
  const cx = snap.caixa || {};
  const vd = snap.vendas || {};
  const crm = snap.crm || {};

  const montarDados = () => ({
    nome: `relatorio-mensal-${ano}-${String(mes).padStart(2, '0')}`,
    titulo: `Fechamento de ${NOMES_MES[mes]} de ${ano}`,
    secoes: [
      {
        titulo: 'Financeiro',
        colunas: [{ chave: 'item', label: 'Item' }, { chave: 'valor', label: 'Valor' }],
        linhas: [
          { item: 'Total que entrou', valor: fmtBRL(fin.receitaBruta) },
          { item: 'Total que saiu', valor: fmtBRL(fin.despesasTotais) },
          { item: 'Despesas variáveis', valor: fmtBRL(fin.despesasVariaveis) },
          { item: 'Despesas fixas', valor: fmtBRL(fin.despesasFixas) },
          { item: 'Lucro do período', valor: fmtBRL(fin.lucroLiquido) },
          { item: 'Margem de lucro', valor: fmtPct(fin.margemLiquida) },
        ],
      },
      {
        titulo: 'Caixa',
        colunas: [{ chave: 'item', label: 'Item' }, { chave: 'valor', label: 'Valor' }],
        linhas: [
          { item: 'Sessões fechadas', valor: fmtNum(cx.sessoesFechadas) },
          { item: 'Retiradas', valor: fmtBRL(cx.totalSangrias) },
          { item: 'Entradas', valor: fmtBRL(cx.totalSuprimentos) },
          { item: 'Diferença acumulada', valor: fmtBRL(cx.diferencaAcumulada) },
        ],
      },
      {
        titulo: 'Vendas',
        colunas: [{ chave: 'item', label: 'Item' }, { chave: 'valor', label: 'Valor' }],
        linhas: [
          { item: 'Total de vendas', valor: fmtNum(vd.total) },
          { item: 'Faturamento', valor: fmtBRL(vd.faturamento) },
          { item: 'Ticket médio', valor: fmtBRL(vd.ticketMedio) },
        ],
      },
      {
        titulo: 'Top produtos',
        colunas: [
          { chave: 'nome', label: 'Produto' },
          { chave: 'quantidade', label: 'Quantidade', valor: (p) => fmtNum(p.quantidade) },
          { chave: 'receita', label: 'Receita', valor: (p) => fmtBRL(p.receita) },
        ],
        linhas: vd.topProdutos || [],
      },
      {
        titulo: 'Clientes',
        colunas: [{ chave: 'item', label: 'Item' }, { chave: 'valor', label: 'Valor' }],
        linhas: [
          { item: 'Novos clientes cadastrados', valor: fmtNum(crm.leadsCriados) },
        ],
      },
    ],
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" icon={ArrowLeft} size="sm" onClick={() => navigate('/app/relatorios/mensais')}>
            Voltar
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">
            {NOMES_MES[mes]} de {ano}
          </h1>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Fechado em {new Date(dados.geradoEm).toLocaleDateString('pt-BR')}
            {dados.geradoPor === 'CRON' ? ' · automático' : ' · gerado manualmente'}
          </div>
        </div>
        <div className="flex items-center gap-2" data-no-print>
          <Badge variant="neutral" size="sm">Snapshot imutável</Badge>
          <BotaoExportar montarDados={montarDados} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={DollarSign}
          color="success"
          label="Total que entrou"
          valor={fmtBRL(fin.receitaBruta)}
          subvalor={`${fmtNum(fin.totalLancamentos)} lançamento(s) pagos`}
          info="Soma de todas as receitas pagas no período."
        />
        <KpiCard
          icon={DollarSign}
          color="danger"
          label="Total que saiu"
          valor={fmtBRL(fin.despesasTotais)}
          subvalor={`Variáveis ${fmtBRL(fin.despesasVariaveis)} · Fixas ${fmtBRL(fin.despesasFixas)}`}
        />
        <KpiCard
          icon={DollarSign}
          color="accent"
          label="Lucro do período"
          valor={fmtBRL(fin.lucroLiquido)}
          subvalor={`Margem ${fmtPct(fin.margemLiquida)}`}
          info="Receitas menos despesas. É o que sobrou no bolso depois de pagar tudo."
        />
        <KpiCard
          icon={ShoppingBag}
          color="info"
          label="Vendas"
          valor={fmtNum(vd.total)}
          subvalor={`Faturamento ${fmtBRL(vd.faturamento)} · Ticket médio ${fmtBRL(vd.ticketMedio)}`}
        />
        <KpiCard
          icon={Wallet}
          color="neutral"
          label="Sessões de caixa"
          valor={fmtNum(cx.sessoesFechadas)}
          subvalor={`Diferença acumulada ${fmtBRL(cx.diferencaAcumulada)}`}
        />
        <KpiCard
          icon={Wallet}
          color="warning"
          label="Retiradas"
          valor={fmtBRL(cx.totalSangrias)}
        />
        <KpiCard
          icon={Wallet}
          color="success"
          label="Entradas no caixa"
          valor={fmtBRL(cx.totalSuprimentos)}
        />
        <KpiCard
          icon={Users}
          color="info"
          label="Clientes novos"
          valor={fmtNum(crm.leadsCriados)}
          subvalor="Cadastrados no período"
        />
      </div>

      {Array.isArray(vd.topProdutos) && vd.topProdutos.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top produtos do mês</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Os que mais geraram receita</div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Quantidade</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Receita</th>
              </tr>
            </thead>
            <tbody>
              {vd.topProdutos.map((p, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)]">{p.nome}</td>
                  <td className="py-3 px-5 text-right text-sm tabular-nums">{fmtNum(p.quantidade)}</td>
                  <td className="py-3 px-5 text-right text-sm font-bold tabular-nums text-[var(--success)]">{fmtBRL(p.receita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
