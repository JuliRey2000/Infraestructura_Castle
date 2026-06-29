'use strict';

const fs = require('fs');
const path = require('path');

const { withinSince } = require('./base-source');
const { extractReadings } = require('./cmc-extract');

/**
 * Adaptador CMC (CoinMarketCap via `cmc-skill-hub`) por SNAPSHOT.
 *
 * El MCP `cmc-skill-hub` solo se invoca desde una sesion de Claude, no por REST.
 * Por eso `requiresKey:false`: los datos NO vienen de una API con key, sino de un
 * archivo de snapshot que la skill de proyecto `/cmc-snapshot` escribe en
 * `data/cmc/<YYYY-MM-DD>.json`. Esta fuente solo LEE ese archivo.
 *
 * Degradacion honesta (Castle Standards): si el snapshot falta o esta stale,
 * `fetch` devuelve [] + warn — nunca lanza ni tumba el run. Sin `catch {}` mudo.
 */

// Raiz del tool: .../tools/news-extractor (este archivo vive en src/sources/).
const TOOL_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SNAPSHOT_DIR = 'data/cmc';
const DEFAULT_MAX_AGE_HOURS = 26; // un poco mas de 24h: tolera atraso del refresco diario
const SNAPSHOT_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;

const MESES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Sesgo -> score de sentimiento (hint para el agente; normalizeItem lo valida).
const BIAS_SCORE = { bullish: 0.5, neutral: 0, bearish: -0.5 };

/** Resuelve snapshotDir: absoluto tal cual; relativo desde la raiz del tool. */
function resolveSnapshotDir(dir) {
  const d = typeof dir === 'string' && dir.trim() ? dir.trim() : DEFAULT_SNAPSHOT_DIR;
  return path.isAbsolute(d) ? d : path.resolve(TOOL_ROOT, d);
}

/** Localiza el snapshot mas reciente (<YYYY-MM-DD>.json) en el directorio. */
function findLatestSnapshot(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null; // directorio inexistente: caso esperado, no es error
  }
  const dated = entries
    .map((f) => {
      const m = SNAPSHOT_FILE_RE.exec(f);
      return m ? { file: path.join(dir, f), date: m[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
  return dated.length ? dated[dated.length - 1] : null;
}

/** Lee y parsea el bundle JSON; null + warn si falla (input externo). */
function readBundle(file, logger) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    logger.warn('cmc: no se pudo leer el snapshot', { error: err.message, file: path.basename(file) });
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    logger.warn('cmc: snapshot con JSON invalido', { error: err.message, file: path.basename(file) });
    return null;
  }
}

/** Edad del bundle en horas segun generatedAt; Infinity si no hay fecha. */
function bundleAgeHours(bundle) {
  const t = Date.parse(bundle && bundle.generatedAt);
  if (!Number.isFinite(t)) return Infinity;
  return (Date.now() - t) / 3.6e6;
}

/** "2026-06-28" -> "28 jun"; '' si invalido. */
function shortDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return '';
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 ? `${d} ${MESES_ABBR[mo - 1]}` : '';
}

module.exports = {
  type: 'cmc',
  requiresKey: false,

  async fetch(query, ctx) {
    const logger = ctx.logger;
    const options = ctx.options || {};
    const dir = resolveSnapshotDir(options.snapshotDir);
    const maxAgeHours =
      Number(options.maxAgeHours) > 0 ? Number(options.maxAgeHours) : DEFAULT_MAX_AGE_HOURS;

    const latest = findLatestSnapshot(dir);
    if (!latest) {
      logger.warn('cmc: sin snapshot disponible (corre /cmc-snapshot)', { dir });
      return [];
    }

    const bundle = readBundle(latest.file, logger);
    if (!bundle) return [];

    const ageHours = bundleAgeHours(bundle);
    if (ageHours > maxAgeHours) {
      logger.warn('cmc: snapshot stale, se omite', {
        ageHours: Number.isFinite(ageHours) ? Number(ageHours.toFixed(1)) : null,
        maxAgeHours,
        file: path.basename(latest.file),
      });
      return [];
    }

    const readings = extractReadings(bundle, { logger, fallbackDate: latest.date });
    const out = [];
    for (const reading of readings) {
      const tsMs = Date.parse(reading.asOf);
      if (withinSince(Number.isFinite(tsMs) ? tsMs : NaN, query.sinceTs)) out.push(reading);
    }
    logger.info('cmc: lecturas del snapshot', {
      file: path.basename(latest.file),
      total: readings.length,
      kept: out.length,
    });
    return out;
  },

  mapRaw(reading) {
    const coin = String(reading.coin || 'MARKET').toUpperCase();
    const isMarket = coin === 'MARKET';
    const category = reading.category;

    // URL HTTPS sintetica, estable y unica por (coin, category, dia). Requisito
    // del normalizador (clave de dedup + semilla de id). Re-runs del mismo dia
    // dan la misma URL => idempotente.
    const url = `https://coinmarketcap.com/cmc-hub/${coin.toLowerCase()}/${category}/${reading.day}`;

    // El sufijo de fecha corta hace el titulo unico por dia: evita que el
    // title-hash del dedup (strategy "both", ventana 48h) suprima una lectura de
    // estado que repite titular dia a dia. El numero de dia siempre difiere
    // dentro de 48h => la lectura aparece cada dia; mismo dia => mismo titulo
    // (idempotente).
    const sd = shortDate(reading.day);
    const base = isMarket ? reading.headline : `${coin} · ${reading.headline}`;
    const title = sd ? `${base} (${sd})` : base;

    const bias = reading.bias;
    const sentiment =
      bias && Object.prototype.hasOwnProperty.call(BIAS_SCORE, bias)
        ? { score: BIAS_SCORE[bias], label: bias }
        : null;

    const summary = reading.value
      ? `${reading.value} — ${reading.interpretation}`
      : reading.interpretation;

    return {
      title,
      url,
      summary,
      publishedAt: reading.asOf || null,
      language: 'es',
      tickers: isMarket ? [] : [coin],
      topics: ['cmc', category],
      sentiment,
      raw: { skill: reading.skill || null, category, coin },
    };
  },
};
