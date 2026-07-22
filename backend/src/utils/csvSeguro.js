/**
 * Parser de CSV defensivo — sem dependencia externa.
 *
 * Seguranca (o CSV do usuario precisa ser VERIFICADO antes de virar dado):
 *  - Recusa binario disfarcado de .csv (byte NUL) -> arquivo nao confiavel.
 *  - Limite de linhas (anti-DoS): arquivo gigante e recusado.
 *  - Remove BOM e detecta o separador (`;` comum no Excel BR, ou `,`).
 *  - Parser com aspas (RFC-4180): campos com `,`/`;`/quebra de linha entre
 *    aspas, com `""` escapado.
 *  - Neutraliza INJECAO DE FORMULA: celulas que comecam com `= + - @` (gatilho
 *    de execucao no Excel/Sheets) tem esses caracteres removidos do inicio.
 *  - Limita o tamanho de cada celula.
 *
 * Retorna `{ headers, rows }` onde headers sao normalizados (minusculo, sem
 * acento) e cada row e um objeto chaveado por esses headers. Lanca Error com
 * `.code = 'CSV_INVALIDO'` e mensagem amigavel quando o arquivo nao serve.
 */

const MAX_LINHAS_PADRAO = 2000;
const MAX_CELULA = 300;

function erroCsv(mensagem) {
  const e = new Error(mensagem);
  e.code = 'CSV_INVALIDO';
  return e;
}

function contar(texto, ch) {
  let n = 0;
  for (let i = 0; i < texto.length; i++) if (texto[i] === ch) n++;
  return n;
}

// Remove acentos e baixa caixa — pra casar headers como "Razão Social".
function normalizarHeader(h) {
  return String(h || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// Defesa contra CSV formula injection + limite de tamanho.
function sanitizarCelula(v) {
  let s = String(v ?? '').trim();
  // Tira gatilhos de formula do inicio (=, +, -, @ e controles tab/CR).
  s = s.replace(/^[=+\-@\t\r]+/, '').trim();
  if (s.length > MAX_CELULA) s = s.slice(0, MAX_CELULA);
  return s;
}

/**
 * Parser de estado: percorre o texto char a char respeitando aspas.
 * Retorna array de linhas, cada uma array de celulas (strings cruas).
 */
function parseLinhas(texto, delim, maxLinhas) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let dentroAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } // "" -> "
        else dentroAspas = false;
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') { dentroAspas = true; continue; }
    if (c === delim) { linha.push(campo); campo = ''; continue; }
    if (c === '\n' || c === '\r') {
      // Fecha a linha em \n ou \r (e pula o \n de um \r\n).
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      linhas.push(linha); linha = [];
      if (linhas.length > maxLinhas) {
        throw erroCsv(`O arquivo tem linhas demais (limite de ${maxLinhas}). Divida em partes menores.`);
      }
      continue;
    }
    campo += c;
  }
  // Ultima linha sem quebra final.
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

function parseCsv(buffer, { maxLinhas = MAX_LINHAS_PADRAO } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw erroCsv('Arquivo vazio ou invalido.');
  }
  // Binario disfarcado de CSV -> recusa (anti-upload-malicioso).
  if (buffer.includes(0)) {
    throw erroCsv('O arquivo nao parece um CSV de texto. Exporte como CSV e tente de novo.');
  }

  let texto = buffer.toString('utf8');
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // BOM
  if (!texto.trim()) throw erroCsv('O arquivo esta vazio.');

  // Detecta separador pela 1a linha (Excel BR costuma usar `;`).
  const fimPrimeira = texto.search(/\r|\n/);
  const primeira = fimPrimeira === -1 ? texto : texto.slice(0, fimPrimeira);
  const delim = contar(primeira, ';') > contar(primeira, ',') ? ';' : ',';

  const linhas = parseLinhas(texto, delim, maxLinhas);
  if (linhas.length < 2) {
    throw erroCsv('O arquivo precisa de um cabecalho e ao menos uma linha de dados.');
  }

  const headers = linhas[0].map(normalizarHeader);
  if (!headers.some(Boolean)) throw erroCsv('Cabecalho do CSV nao reconhecido.');

  const rows = linhas.slice(1)
    .filter((cols) => cols.some((c) => c && c.trim() !== '')) // ignora linhas em branco
    .map((cols) => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = sanitizarCelula(cols[i] ?? ''); });
      return obj;
    });

  if (!rows.length) throw erroCsv('Nenhuma linha de dados encontrada.');
  return { headers, rows };
}

module.exports = { parseCsv, normalizarHeader, sanitizarCelula, MAX_LINHAS_PADRAO };
