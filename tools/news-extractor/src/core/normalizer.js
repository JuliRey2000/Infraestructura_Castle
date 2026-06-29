'use strict';

const crypto = require('crypto');
const baseLogger = require('./logger');

/**
 * Normalizacion y validacion de items externos -> NewsItem canonico.
 *
 * Regla Castle Capital: TODO input externo se valida aqui. Un item malformado
 * se descarta + loguea, nunca tumba el run. El campo `raw` se conserva solo
 * para data/*.json y NUNCA se renderiza ni se pasa a un agente.
 *
 * @typedef {object} NewsItem
 * @property {string} id            sha256(canonicalUrl || title+source)
 * @property {string} source        nombre legible de la fuente
 * @property {string} sourceType    tipo de adaptador (rss|coingecko|...)
 * @property {string} title
 * @property {string} url           solo https
 * @property {string} canonicalUrl  sin params de tracking (clave de dedup)
 * @property {string} summary       texto saneado
 * @property {string|null} publishedAt ISO-UTC o null
 * @property {string} fetchedAt     ISO-UTC
 * @property {string} language
 * @property {string[]} tickers
 * @property {string[]} topics
 * @property {{score:number,label:string}|null} sentiment
 * @property {object} [raw]         solo persistido, nunca renderizado
 */

const TRACKING_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^igshid$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^source$/i,
  /^cmpid$/i,
  /^_hsenc$/i,
  /^_hsmi$/i,
];

const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&hellip;': '...',
  '&mdash;': '-',
  '&ndash;': '-',
};

const MAX_TITLE = 300;
const MAX_SUMMARY = 600;

/** Saneamiento de texto: quita HTML, decodifica entidades, recorta. */
function sanitizeText(input, maxLen) {
  if (input == null) return '';
  let s = String(input);
  s = s.replace(/<[^>]*>/g, ' '); // quitar tags
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : '';
  });
  s = s.replace(/&[a-zA-Z#0-9]+;/g, (m) => HTML_ENTITIES[m.toLowerCase()] || HTML_ENTITIES[m] || '');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' '); // control chars
  s = s.replace(/\s+/g, ' ').trim();
  if (maxLen && s.length > maxLen) s = `${s.slice(0, maxLen - 1).trimEnd()}…`;
  return s;
}

/** Normaliza una URL a su forma canonica (sin tracking, sin hash). */
function canonicalizeUrl(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null; // HTTPS obligatorio
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  const keep = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!k) continue; // descartar params con clave vacia (artefactos de ?&)
    if (!TRACKING_PARAMS.some((re) => re.test(k))) keep.push([k, v]);
  }
  u.search = '';
  keep.sort((a, b) => a[0].localeCompare(b[0]));
  for (const [k, v] of keep) u.searchParams.append(k, v);
  let href = u.toString();
  if (href.endsWith('/') && u.pathname !== '/') href = href.slice(0, -1);
  return href;
}

/** Parsea una fecha de cualquier formato a ISO-UTC; null si invalida. */
function toIsoUtc(value) {
  if (value == null || value === '') return null;
  let d;
  if (typeof value === 'number') {
    // epoch en segundos vs milisegundos
    d = new Date(value < 1e12 ? value * 1000 : value);
  } else if (/^\d+$/.test(String(value).trim())) {
    const n = Number(value);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function computeId(canonicalUrl, title, source) {
  const key = canonicalUrl || `${title}|${source}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

const SENTIMENT_LABELS = new Set(['bullish', 'neutral', 'bearish']);

function normalizeSentiment(sentiment) {
  if (!sentiment || typeof sentiment !== 'object') return null;
  let score = Number(sentiment.score);
  if (!Number.isFinite(score)) return null;
  score = Math.max(-1, Math.min(1, score));
  let label = String(sentiment.label || '').toLowerCase();
  if (!SENTIMENT_LABELS.has(label)) {
    label = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral';
  }
  return { score: Number(score.toFixed(3)), label };
}

function cleanStringArray(arr, { upper = false, max = 25 } = {}) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    let s = v.trim();
    if (!s) continue;
    if (upper) s = s.toUpperCase();
    s = s.slice(0, 40);
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Normaliza un item parcial (salida de adaptador.mapRaw) a NewsItem.
 * @param {object} partial campos crudos ya mapeados por el adaptador
 * @param {{ source:string, sourceType:string, language?:string, logger?:object }} ctx
 * @returns {NewsItem|null} null si el item es invalido (descartado)
 */
function normalizeItem(partial, ctx) {
  const logger = (ctx && ctx.logger) || baseLogger;
  if (!partial || typeof partial !== 'object') return null;

  const title = sanitizeText(partial.title, MAX_TITLE);
  if (!title) {
    logger.debug('Item descartado: sin title', { source: ctx.source });
    return null;
  }

  const rawUrl = typeof partial.url === 'string' ? partial.url.trim() : '';
  const canonicalUrl = canonicalizeUrl(rawUrl);
  if (!rawUrl || !canonicalUrl) {
    logger.debug('Item descartado: url ausente o no-https', {
      source: ctx.source,
      title: title.slice(0, 60),
    });
    return null;
  }

  const fetchedAt = new Date().toISOString();
  const sourceType = ctx.sourceType || partial.sourceType || 'unknown';
  const source = ctx.source || partial.source || sourceType;

  return {
    id: computeId(canonicalUrl, title, source),
    source,
    sourceType,
    title,
    url: canonicalUrl,
    canonicalUrl,
    summary: sanitizeText(partial.summary, MAX_SUMMARY),
    publishedAt: toIsoUtc(partial.publishedAt),
    fetchedAt,
    language: partial.language || (ctx && ctx.language) || 'en',
    tickers: cleanStringArray(partial.tickers, { upper: true }),
    topics: cleanStringArray(partial.topics),
    sentiment: normalizeSentiment(partial.sentiment),
    raw: partial.raw !== undefined ? partial.raw : undefined,
  };
}

/** Devuelve una copia del item SIN el campo `raw` (para agente/markdown). */
function stripRaw(item) {
  if (!item || typeof item !== 'object') return item;
  const { raw, ...rest } = item;
  void raw;
  return rest;
}

module.exports = {
  normalizeItem,
  stripRaw,
  sanitizeText,
  canonicalizeUrl,
  toIsoUtc,
  computeId,
  normalizeSentiment,
  cleanStringArray,
  MAX_TITLE,
  MAX_SUMMARY,
};
