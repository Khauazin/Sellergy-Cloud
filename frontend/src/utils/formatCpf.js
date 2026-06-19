// =====================================================================
// FORMATADOR DE CPF
// =====================================================================
// Aplica mascara XXX.XXX.XXX-XX progressivamente conforme o usuario digita.
// Maximo: 11 digitos. Backend recebe e armazena so com digitos (sem mascara).

export function formatarCpf(valor) {
  const d = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Tira mascara — util pra mandar pro backend so com digitos.
export function limparCpf(valor) {
  return (valor || '').replace(/\D/g, '');
}
