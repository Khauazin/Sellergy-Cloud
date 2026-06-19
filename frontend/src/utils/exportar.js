// =====================================================================
// Helpers de exportação de relatórios
// =====================================================================
// Três formatos suportados:
//   - CSV: zero dependências, gera Blob com UTF-8 BOM (abre no Excel BR
//     sem bagunçar acentos).
//   - XLSX: usa SheetJS. Múltiplas abas (1 sheet por "seção").
//   - PDF: usa window.print() com CSS @media print (sem dependência).
//
// Estrutura comum esperada nas funções de export:
//
//   {
//     nome: 'relatorio-financeiro',           // base do arquivo
//     titulo: 'Relatório Financeiro',          // título legível
//     periodo: '01/04/2026 a 30/04/2026',      // string formatada
//     filtrosAtivos: ['Categoria: Aluguel'],   // lista opcional
//     secoes: [
//       {
//         titulo: 'Resumo',
//         colunas: [{ chave: 'item', label: 'Item' }, { chave: 'valor', label: 'Valor' }],
//         linhas: [{ item: 'Receita', valor: 1500 }, ...],
//       },
//       ...
//     ],
//   }

import * as XLSX from 'xlsx';

// Converte um array de objetos em string CSV com separador de vírgula.
// Escapa aspas duplas, envolve em aspas quando o valor contém vírgula,
// quebra de linha ou aspas. UTF-8 BOM no início para Excel reconhecer.
function arrayParaCsv(colunas, linhas) {
  const escapar = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const cab = colunas.map((c) => escapar(c.label)).join(',');
  const corpo = linhas.map((linha) =>
    colunas.map((c) => escapar(typeof c.valor === 'function' ? c.valor(linha) : linha[c.chave])).join(',')
  ).join('\n');
  return `${cab}\n${corpo}`;
}

function baixar(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =====================================================================
// CSV
// =====================================================================
// Concatena todas as seções num único arquivo, separadas por linha em
// branco e o título da seção.
export function exportarCSV({ nome, titulo, periodo, filtrosAtivos = [], secoes = [] }) {
  const partes = [];
  if (titulo) partes.push(titulo);
  if (periodo) partes.push(`Período: ${periodo}`);
  if (filtrosAtivos.length > 0) partes.push(`Filtros: ${filtrosAtivos.join('; ')}`);
  partes.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  partes.push(''); // linha em branco

  for (const secao of secoes) {
    if (!secao.linhas || secao.linhas.length === 0) continue;
    partes.push(secao.titulo);
    partes.push(arrayParaCsv(secao.colunas, secao.linhas));
    partes.push(''); // linha em branco entre seções
  }

  // BOM UTF-8 no início garante leitura correta de acentos no Excel.
  const conteudo = '﻿' + partes.join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  baixar(blob, `${nome}.csv`);
}

// =====================================================================
// XLSX — uma aba (sheet) por seção
// =====================================================================
export function exportarXLSX({ nome, titulo, periodo, filtrosAtivos = [], secoes = [] }) {
  const workbook = XLSX.utils.book_new();

  // Sheet "Resumo" no início com metadados
  const meta = [
    [titulo || nome],
    [periodo ? `Período: ${periodo}` : ''],
    filtrosAtivos.length > 0 ? [`Filtros: ${filtrosAtivos.join('; ')}`] : [''],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
  ].filter((linha) => linha[0] !== '');
  const sheetMeta = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.book_append_sheet(workbook, sheetMeta, 'Sobre');

  // Demais sheets — uma por seção
  let contador = 1;
  for (const secao of secoes) {
    if (!secao.linhas || secao.linhas.length === 0) continue;

    // Cabeçalho
    const aoa = [secao.colunas.map((c) => c.label)];
    // Linhas
    for (const linha of secao.linhas) {
      aoa.push(secao.colunas.map((c) =>
        typeof c.valor === 'function' ? c.valor(linha) : linha[c.chave]
      ));
    }
    const sheet = XLSX.utils.aoa_to_sheet(aoa);

    // Sheet name limitado a 31 chars pelo Excel; remove caracteres inválidos.
    const nomeSheet = (secao.titulo || `Aba ${contador++}`)
      .replace(/[\\/?*[\]]/g, '')
      .slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, nomeSheet);
  }

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  baixar(blob, `${nome}.xlsx`);
}

// =====================================================================
// PDF — usa window.print() com @media print
// =====================================================================
// Não gera o arquivo direto; abre o diálogo de impressão do navegador.
// O usuário escolhe "Salvar como PDF" no destino. Vantagem: zero
// dependência e qualidade visual idêntica à tela.
//
// Aplica uma classe `imprimindo` no body antes (caso queira ajustes
// dinâmicos pontuais) e remove depois.
export function exportarPDF() {
  document.body.classList.add('imprimindo');
  // Pequeno delay garante que repaint considerou a classe antes do print.
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('imprimindo'), 500);
  }, 50);
}
