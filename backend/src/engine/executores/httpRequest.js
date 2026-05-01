const axios = require('axios');
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { interpolar } = require('../expressoes');

const TIMEOUT_MIN = 1000;
const TIMEOUT_MAX = 120_000;
const TIMEOUT_PADRAO = 10_000;
const TAMANHO_MAX_RESPOSTA = 5 * 1024 * 1024; // 5MB

// IPs RFC1918 + loopback + link-local + 0.0.0.0/8 + reservados.
// Bloqueamos antes do connect para mitigar SSRF (ex.: pivot pra metadados de cloud).
const RANGES_BLOQUEADOS_V4 = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.0.0.0', '192.0.0.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['224.0.0.0', '255.255.255.255'],
].map(([from, to]) => [ipParaInt(from), ipParaInt(to)]);

function ipParaInt(ip) {
  return ip
    .split('.')
    .reduce((acc, parte) => (acc << 8) + parseInt(parte, 10), 0) >>> 0;
}

function ipBloqueado(endereco) {
  if (net.isIPv6(endereco)) return true; // por simplicidade, IPv6 e bloqueado
  if (!net.isIPv4(endereco)) return true;
  const valor = ipParaInt(endereco);
  return RANGES_BLOQUEADOS_V4.some(([from, to]) => valor >= from && valor <= to);
}

// Lookup customizado: bloqueia o connect se o DNS resolver para faixa privada.
function lookupSeguro(hostname, opcoes, callback) {
  // Permite assinatura curta `lookupSeguro(hostname, callback)`.
  if (typeof opcoes === 'function') {
    callback = opcoes;
    opcoes = {};
  }
  dns.lookup(hostname, opcoes, (err, address, family) => {
    if (err) return callback(err);
    if (ipBloqueado(address)) {
      const e = new Error(`Endereco bloqueado por politica SSRF: ${address}`);
      e.code = 'ESSRFBLOCKED';
      return callback(e);
    }
    callback(null, address, family);
  });
}

const agentHttp = new http.Agent({ keepAlive: false, lookup: lookupSeguro });
const agentHttps = new https.Agent({ keepAlive: false, lookup: lookupSeguro });

async function executar({ no, contexto }) {
  const dados = no.dados || {};

  const url = interpolar(dados.url || '', contexto);
  if (!url) throw new Error('HTTP: URL nao informada.');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`HTTP: URL invalida (${url}).`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`HTTP: protocolo nao suportado (${parsed.protocol}).`);
  }

  // SSRF: se for IP literal, dns.lookup nao e chamado e o agent nao bloqueia.
  // Validamos aqui antes do request.
  const hostBruto = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostBruto) && ipBloqueado(hostBruto)) {
    throw new Error(`Endereco bloqueado por politica SSRF: ${hostBruto}`);
  }

  const cabecalhos = {};
  for (const c of Array.isArray(dados.cabecalhos) ? dados.cabecalhos : []) {
    if (!c?.chave) continue;
    cabecalhos[interpolar(c.chave, contexto)] = interpolar(c.valor || '', contexto);
  }

  let corpo = interpolar(dados.corpo || '', contexto);
  const ctype = Object.keys(cabecalhos).find((k) => k.toLowerCase() === 'content-type');
  if (corpo && ctype && cabecalhos[ctype].toLowerCase().includes('application/json')) {
    try {
      corpo = JSON.parse(corpo);
    } catch {
      // Mantem string se nao for JSON valido.
    }
  }

  const timeoutMs = Math.min(
    Math.max(Number(dados.timeoutMs) || TIMEOUT_PADRAO, TIMEOUT_MIN),
    TIMEOUT_MAX
  );

  const resp = await axios({
    method: (dados.metodo || 'GET').toUpperCase(),
    url,
    headers: cabecalhos,
    data: corpo === '' ? undefined : corpo,
    timeout: timeoutMs,
    httpAgent: agentHttp,
    httpsAgent: agentHttps,
    maxRedirects: 0,
    maxContentLength: TAMANHO_MAX_RESPOSTA,
    maxBodyLength: TAMANHO_MAX_RESPOSTA,
    validateStatus: () => true,
    transitional: { clarifyTimeoutError: true },
  });

  return {
    saida: {
      status: resp.status,
      cabecalhos: resp.headers,
      corpo: resp.data,
    },
  };
}

module.exports = { executar };
