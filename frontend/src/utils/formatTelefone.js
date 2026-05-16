// =====================================================================
// FORMATADOR DE TELEFONE — PADRAO BR
// =====================================================================
// Formata progressivamente conforme o usuario digita.
// Maximo: 11 digitos (DDD + 9 digitos pra celular). Tudo alem disso e descartado.
// Detecta automaticamente se e fixo (10 digitos) ou celular (11 digitos):
//   - (11) 99999-9999  celular
//   - (11) 9999-9999   fixo
//
// Backend ja faz `.replace(/\D/g, '')` pra comparacao, entao a mascara aqui
// e puramente cosmetica — nao precisa "limpar" antes de enviar.

export function formatarTelefoneBR(valor) {
  const digitos = (valor || '').replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  // Celular: (XX) XXXXX-XXXX
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

// Versao internacional pra campos tecnicos (ex: canal do bot WhatsApp).
// Aceita prefixo '+' e limita a 15 digitos (padrao E.164).
export function formatarTelefoneIntl(valor) {
  const temMais = (valor || '').trim().startsWith('+');
  const digitos = (valor || '').replace(/\D/g, '').slice(0, 15);
  if (digitos.length === 0) return temMais ? '+' : '';
  return temMais ? `+${digitos}` : digitos;
}
