'use strict';

const crypto = require('crypto');
const { parseDuration } = require('./duration');

/**
 * Deduplicacion por canonical-url + title-hash dentro de una ventana temporal.
 *
 * - Intra-run: descarta repetidos dentro del mismo lote.
 * - Inter-run: usa un indice persistente (`.dedup-index.json`) para no repetir
 *   un item ya publicado en un brief reciente (dentro de `window`).
 *
 * strategy: 'url' | 'title' | 'both' (default). 'both' = es duplicado si la url
 * O el title-hash ya se vieron.
 */

/** Hash estable del titulo: minusculas, sin puntuacion, espacios colapsados. */
function titleHash(title) {
  const norm = String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // quitar diacriticos
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!norm) return null;
  return `t:${crypto.createHash('sha1').update(norm).digest('hex').slice(0, 16)}`;
}

/** Llaves de dedup de un item segun la estrategia. */
function keysForItem(item, strategy) {
  const keys = [];
  if (strategy === 'url' || strategy === 'both') {
    if (item.canonicalUrl) keys.push(`u:${item.canonicalUrl}`);
  }
  if (strategy === 'title' || strategy === 'both') {
    const th = titleHash(item.title);
    if (th) keys.push(th);
  }
  // Fallback: si no hubo llaves (sin url ni titulo util), usar el id.
  if (keys.length === 0 && item.id) keys.push(`i:${item.id}`);
  return keys;
}

/** Elimina entradas del indice mas viejas que la ventana. */
function pruneIndex(index, windowMs, now = Date.now()) {
  const out = {};
  for (const [key, ts] of Object.entries(index || {})) {
    const t = Date.parse(ts);
    if (Number.isFinite(t) && now - t <= windowMs) out[key] = ts;
  }
  return out;
}

/**
 * Deduplica un lote de items.
 * @param {object[]} items NewsItem[]
 * @param {object} opts
 * @param {string} [opts.strategy] url|title|both
 * @param {string|number} [opts.window] ventana (ej "48h")
 * @param {object} [opts.index] indice persistente { key: isoTs }
 * @returns {{ kept: object[], removed: object[], index: object, stats: object }}
 */
function dedupe(items, opts = {}) {
  const strategy = opts.strategy || 'both';
  const windowMs = parseDuration(opts.window || '48h', 'dedup.window');
  const now = Date.now();
  const index = pruneIndex(opts.index || {}, windowMs, now);

  // Snapshot de llaves ya presentes (de runs previos) para clasificar inter vs intra.
  const preExisting = new Set(Object.keys(index));
  const seen = new Set(preExisting);
  const kept = [];
  const removed = [];
  let intra = 0;
  let inter = 0;

  for (const item of items) {
    const keys = keysForItem(item, strategy);
    const already = keys.find((k) => seen.has(k));
    if (already) {
      removed.push(item);
      if (preExisting.has(already)) inter += 1;
      else intra += 1;
      continue;
    }
    kept.push(item);
    const ts = new Date(now).toISOString();
    for (const k of keys) {
      seen.add(k);
      index[k] = ts;
    }
  }

  return {
    kept,
    removed,
    index,
    stats: { input: items.length, kept: kept.length, removed: removed.length, intra, inter },
  };
}

module.exports = { dedupe, titleHash, keysForItem, pruneIndex };
