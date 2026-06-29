'use strict';

/**
 * Contrato de FUENTE (adaptador intercambiable).
 *
 * Cada adaptador es un modulo CommonJS que exporta:
 *
 *   module.exports = {
 *     type: 'coingecko',            // id unico del adaptador
 *     requiresKey: true,            // si necesita API key
 *     envKey: 'COINGECKO_API_KEY',  // nombre de la env var (secreto, nunca en YAML)
 *     async fetch(query, ctx) { ... return RawItem[] },
 *     mapRaw(raw) { ... return NewsItemPartial },
 *   };
 *
 * Agregar una fuente = crear src/sources/<name>.js + una linea en index.js.
 * El core nunca importa logica del adaptador mas alla de este contrato.
 *
 * @typedef {object} SourceQuery
 * @property {string[]} keywords
 * @property {string[]} tickers
 * @property {string[]} topics
 * @property {number} sinceTs   timestamp (ms) limite inferior de publicacion
 * @property {string} sinceIso  el mismo limite en ISO-UTC
 * @property {number} limit     maximo de items a devolver
 *
 * @typedef {object} SourceContext
 * @property {import('../core/http-client').HttpClient} http
 * @property {object} logger
 * @property {AbortSignal} [signal]
 * @property {object} [options]   opciones declaradas en el brief (source.options)
 *
 * @typedef {object} NewsItemPartial
 * @property {string} title
 * @property {string} url
 * @property {string} [summary]
 * @property {string|number} [publishedAt]
 * @property {string} [language]
 * @property {string[]} [tickers]
 * @property {string[]} [topics]
 * @property {{score:number,label?:string}} [sentiment]
 * @property {object} [raw]
 */

/** Limita un valor a [1, max] con default. */
function clampLimit(value, def = 30, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

/** True si el timestamp (ms) es >= sinceTs (o si no hay fecha → se acepta). */
function withinSince(tsMs, sinceTs) {
  if (!Number.isFinite(tsMs)) return true; // sin fecha confiable: no filtrar
  if (!Number.isFinite(sinceTs)) return true;
  return tsMs >= sinceTs;
}

/** Devuelve los primeros n elementos de un array (defensivo). */
function take(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

/** Valida que un objeto cumpla el contrato minimo de adaptador. */
function validateAdapter(mod, name) {
  const problems = [];
  if (!mod || typeof mod !== 'object') problems.push('no exporta un objeto');
  else {
    if (typeof mod.type !== 'string') problems.push('falta "type"');
    if (typeof mod.fetch !== 'function') problems.push('falta "fetch"');
    if (typeof mod.mapRaw !== 'function') problems.push('falta "mapRaw"');
    if (mod.requiresKey && typeof mod.envKey !== 'string') {
      problems.push('requiresKey=true pero falta "envKey"');
    }
  }
  if (problems.length) {
    throw new Error(`Adaptador invalido "${name}": ${problems.join(', ')}`);
  }
  return mod;
}

module.exports = { clampLimit, withinSince, take, validateAdapter };
