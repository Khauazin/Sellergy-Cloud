/**
 * Leitor SEGURO de NF-e (XML) — sem dependencia de parser de XML.
 *
 * Por que nao usar um parser de XML de verdade? Porque e exatamente o parser
 * (com resolucao de DTD/entidades) que abre as brechas classicas: XXE (ler
 * arquivos locais / SSRF via entidade externa) e "billion laughs" (expansao
 * recursiva de entidades -> DoS). Aqui tratamos o arquivo como TEXTO LIMITADO
 * e extraimos so os campos da NF-e, sem NUNCA expandir entidade nenhuma.
 *
 * Barreiras (defesa em profundidade):
 *  - Recusa binario (byte NUL) e arquivo grande (anti-DoS; o multer ja limita).
 *  - Recusa QUALQUER declaracao de DTD/entidade: <!DOCTYPE, <!ENTITY, <!ELEMENT,
 *    <!ATTLIST, <!NOTATION  -> bloqueia XXE, entidade externa e billion laughs.
 *  - Recusa instrucoes de processamento que nao sejam a declaracao <?xml ...?>
 *    (ex.: <?php ... ?>).
 *  - Decodifica SOMENTE as 5 entidades XML predefinidas + refs numericas; uma
 *    entidade custom (&xxe;) fica literal, nunca e resolvida.
 *  - Limita o numero de itens e o tamanho de cada valor.
 *  - Regex sem quantificador aninhado (sem ReDoS).
 *
 * Lanca Error com `.code = 'XML_INVALIDO'` e mensagem amigavel quando recusa.
 */

const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_ITENS = 500;
const MAX_VALOR = 200;

function erroXml(mensagem) {
  const e = new Error(mensagem);
  e.code = 'XML_INVALIDO';
  return e;
}

function fromCharCodeSeguro(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try { return String.fromCodePoint(code); } catch { return ''; }
}

// Decodifica APENAS as 5 entidades predefinidas + refs numericas. Entidades
// customizadas (&qualquer;) NAO sao resolvidas — ficam literais (sem XXE).
function decodeXmlText(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCharCodeSeguro(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => fromCharCodeSeguro(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // amp por ultimo, senao &amp;lt; viraria <
}

// Primeiro valor de um elemento folha: <tag ...>texto</tag>. `[^<]*` impede
// backtracking (nao casa filhos) — seguro contra ReDoS.
function primeiroValor(texto, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`, 'i');
  const m = texto.match(re);
  return m ? decodeXmlText(m[1].trim()).slice(0, MAX_VALOR) : null;
}

// Trecho entre <abre ...> e </fecha> (via indexOf — sem regex/backtracking).
function blocoEntre(texto, abre, fecha) {
  const i = texto.search(new RegExp(`<${abre}\\b`, 'i'));
  if (i === -1) return null;
  const j = texto.toLowerCase().indexOf(`</${fecha.toLowerCase()}>`, i);
  if (j === -1) return null;
  return texto.slice(i, j);
}

function parseNfe(buffer, { maxBytes = MAX_BYTES, maxItens = MAX_ITENS } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw erroXml('Arquivo vazio ou invalido.');
  if (buffer.length > maxBytes) throw erroXml('Arquivo XML grande demais.');
  if (buffer.includes(0)) throw erroXml('O arquivo nao parece um XML de texto.');

  let texto = buffer.toString('utf8');
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // BOM
  const t = texto.trim();
  if (!t) throw erroXml('O arquivo esta vazio.');

  // ANTI-XXE / ANTI-DoS: NF-e nunca tem DTD nem entidades. Qualquer declaracao
  // desse tipo e recusada de cara (XXE, entidade externa, billion laughs).
  if (/<!DOCTYPE/i.test(t) || /<!ENTITY/i.test(t) || /<!ELEMENT/i.test(t)
    || /<!ATTLIST/i.test(t) || /<!NOTATION/i.test(t)) {
    throw erroXml('XML com DTD ou entidades nao e aceito (protecao de seguranca).');
  }
  // Recusa qualquer instrucao de processamento que nao seja a declaracao <?xml?>.
  const pis = t.match(/<\?[\s\S]*?\?>/g) || [];
  for (const pi of pis) {
    if (!/^<\?xml[\s>]/i.test(pi)) {
      throw erroXml('XML com instrucao de processamento nao permitida.');
    }
  }

  // Tem cara de NF-e?
  if (!/<\s*(nfeProc|NFe|infNFe)\b/i.test(t)) {
    throw erroXml('O arquivo nao parece uma NF-e.');
  }

  const numero = primeiroValor(t, 'nNF');
  const emitidaEm = primeiroValor(t, 'dhEmi') || primeiroValor(t, 'dEmi');

  // Fornecedor: escopo no bloco <emit> pra nao pegar o CNPJ do <dest>.
  const emit = blocoEntre(t, 'emit', 'emit');
  const cnpjEmit = emit ? (primeiroValor(emit, 'CNPJ') || '') : '';
  const fornecedor = {
    cnpj: cnpjEmit.replace(/\D+/g, ''),
    nome: emit ? primeiroValor(emit, 'xNome') : null,
  };

  // Itens: cada <det> -> <prod>.
  const itens = [];
  const reDet = /<det\b[^>]*>([\s\S]*?)<\/det>/gi;
  let m;
  let guarda = 0;
  while ((m = reDet.exec(t)) !== null) {
    if (++guarda > maxItens) throw erroXml(`Nota com itens demais (limite de ${maxItens}).`);
    const prod = blocoEntre(m[1], 'prod', 'prod') || m[1];
    const descricao = primeiroValor(prod, 'xProd');
    const codigo = primeiroValor(prod, 'cProd');
    const quantidade = Number(primeiroValor(prod, 'qCom'));
    const custoUnitario = Number(primeiroValor(prod, 'vUnCom'));
    if (!descricao && !Number.isFinite(quantidade)) continue;
    itens.push({
      codigo: codigo || null,
      descricao: descricao || 'Item',
      quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0,
      custoUnitario: Number.isFinite(custoUnitario) && custoUnitario >= 0
        ? Math.round(custoUnitario * 100) / 100
        : 0,
    });
  }
  if (itens.length === 0) throw erroXml('Nenhum item encontrado na NF-e.');

  return { numero, emitidaEm, fornecedor, itens };
}

module.exports = { parseNfe, decodeXmlText };
