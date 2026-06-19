// =====================================================================
// useFiltrosUrl — estado de filtros sincronizado com query string
// =====================================================================
// Vantagens:
//   - Compartilhar URL = compartilhar a mesma visão filtrada.
//   - Voltar do navegador restaura o estado.
//   - Refresh não perde os filtros.
//
// API:
//   const [filtros, setFiltros] = useFiltrosUrl({ preset: '30d', categoriaId: '' });
//
// `defaults` define a estrutura inicial; chaves não presentes na URL
// caem nos valores default. Valores são lidos como string (ou null).
// O caller é responsável por converter quando necessário.

import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

export default function useFiltrosUrl(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filtros = useMemo(() => {
    const obj = { ...defaults };
    for (const chave of Object.keys(defaults)) {
      const v = searchParams.get(chave);
      if (v !== null) obj[chave] = v;
    }
    return obj;
  }, [searchParams, defaults]);

  const setFiltros = useCallback((novosFiltros) => {
    const next = new URLSearchParams(searchParams);
    // Aceita callback (estilo setState) ou objeto direto.
    const aplicar = typeof novosFiltros === 'function'
      ? novosFiltros(filtros)
      : { ...filtros, ...novosFiltros };

    for (const [chave, valor] of Object.entries(aplicar)) {
      const ehDefault = defaults[chave] === valor;
      if (valor === null || valor === undefined || valor === '' || ehDefault) {
        next.delete(chave);
      } else {
        next.set(chave, String(valor));
      }
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, filtros, defaults]);

  const limpar = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    for (const chave of Object.keys(defaults)) next.delete(chave);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, defaults]);

  return [filtros, setFiltros, limpar];
}
