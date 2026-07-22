/**
 * Validações fiscais — núcleo de segurança/integridade da emissão.
 *
 * Tudo aqui é puro (sem I/O) e defensivo: documentos com dígito verificador,
 * códigos fiscais com tamanho exato, e o GATE de produção que impede emitir uma
 * nota real incompleta. Também a regra que mantém o certificado FORA do nosso
 * banco (fica no provedor) e o resolvedor de modo que nunca vai a 'live' por
 * acidente.
 */

const soDigitos = (s) => String(s ?? '').replace(/\D+/g, '');

const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

// ---------- CNPJ / CPF com dígito verificador ----------
function validarCnpj(v) {
  const cnpj = soDigitos(v);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (pesos) => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) soma += Number(cnpj[i]) * pesos[i];
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function validarCpf(v) {
  const cpf = soDigitos(v);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (qtd) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(cpf[i]) * (qtd + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

// CNPJ (14) ou CPF (11). Vazio é "não informado" (decide o chamador).
function validarDocumento(v) {
  const d = soDigitos(v);
  if (d.length === 14) return validarCnpj(d);
  if (d.length === 11) return validarCpf(d);
  return false;
}

// ---------- Códigos fiscais (tamanho exato; vazio = não informado) ----------
const ehVazio = (v) => v === undefined || v === null || String(v).trim() === '';
const temNDigitos = (v, n) => new RegExp(`^\\d{${n}}$`).test(soDigitos(v));

const validarNcm = (v) => ehVazio(v) || temNDigitos(v, 8);
const validarCfop = (v) => ehVazio(v) || temNDigitos(v, 4);
const validarCest = (v) => ehVazio(v) || temNDigitos(v, 7);
const validarUf = (v) => ehVazio(v) || UFS.has(String(v).trim().toUpperCase());
const validarCep = (v) => ehVazio(v) || temNDigitos(v, 8);

// ---------- Modo de operação (fixture x live) ----------
// LIVE (emite de verdade no SEFAZ via provedor) só quando DUAS condições batem:
//   1. variável de ambiente FISCAL_LIVE === 'true' (opt-in deliberado do operador);
//   2. o tenant está com ambiente === 'PRODUCAO'.
// Sem isso, SEMPRE 'fixture' — nunca emite real por acidente.
function resolverModoFiscal(config) {
  const liveHabilitado = String(process.env.FISCAL_LIVE || '').toLowerCase() === 'true';
  return liveHabilitado && config?.ambiente === 'PRODUCAO' ? 'live' : 'fixture';
}

// ---------- Certificado: NUNCA fica conosco ----------
// O certificado digital (.pfx/PKCS#12) vai pro PROVEDOR; guardamos só uma
// referência (certificadoRef). Esta função detecta tentativa de mandar o
// conteúdo do certificado/senha pro nosso backend — que deve ser RECUSADA.
const CHAVES_CERTIFICADO = [
  'certificado', 'certificadoBase64', 'certificadoConteudo', 'certificadoArquivo',
  'pfx', 'pkcs12', 'p12', 'senhaCertificado', 'certificadoSenha', 'certPassword',
];
function conteudoCertificadoProibido(body) {
  if (!body || typeof body !== 'object') return null;
  for (const k of CHAVES_CERTIFICADO) {
    if (body[k] !== undefined && body[k] !== null && String(body[k]).trim() !== '') return k;
  }
  // Heurística: um "certificadoRef" gigante provavelmente é o próprio binário.
  if (typeof body.certificadoRef === 'string' && body.certificadoRef.length > 200) return 'certificadoRef';
  return null;
}

// ---------- Gate de prontidão para PRODUÇÃO ----------
// Antes de emitir DE VERDADE, exige a identidade do emitente, o certificado (ref)
// e a credencial. Para NF-e real, cada item precisa de NCM e CFOP. Devolve a
// lista do que falta (vazia = pronto). Em fixture isto não é chamado.
function validarProntidaoProducao(config, itens = []) {
  const falta = [];
  const c = config || {};
  if (!c.razaoSocial) falta.push('razão social do emitente');
  if (!validarCnpj(c.cnpj)) falta.push('CNPJ do emitente válido');
  if (!c.inscricao) falta.push('inscrição estadual');
  if (!c.logradouro || !c.municipio || !validarUf(c.uf) || !validarCep(c.cep)) {
    falta.push('endereço do emitente (logradouro, município, UF, CEP)');
  }
  if (!c.certificadoRef) falta.push('certificado digital configurado no provedor');
  if (!c.credencialId) falta.push('credencial do provedor');
  itens.forEach((it, i) => {
    if (!temNDigitos(it?.ncm, 8)) falta.push(`NCM do item ${i + 1}`);
    if (!temNDigitos(it?.cfop, 4)) falta.push(`CFOP do item ${i + 1}`);
  });
  return falta;
}

module.exports = {
  soDigitos,
  validarCnpj,
  validarCpf,
  validarDocumento,
  validarNcm,
  validarCfop,
  validarCest,
  validarUf,
  validarCep,
  resolverModoFiscal,
  conteudoCertificadoProibido,
  validarProntidaoProducao,
  UFS,
};
