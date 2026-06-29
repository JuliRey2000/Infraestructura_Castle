'use strict';

/**
 * Helper puro (cero dependencias) para el adaptador `cmc`.
 *
 * Convierte un BUNDLE de snapshot de CoinMarketCap (escrito por la skill de
 * proyecto `/cmc-snapshot`) en LECTURAS normalizadas que `cmc.js` mapea a items.
 *
 * Decision de diseno (importante):
 *   El MCP `cmc-skill-hub` solo se invoca desde una sesion de Claude. La skill
 *   `/cmc-snapshot` ya normaliza cada resultado crudo a un "pack" con forma
 *   estable ANTES de escribir el archivo. Por eso este modulo parsea un esquema
 *   propio y estable (no la salida cruda y cambiante de CMC): el parsing por-skill
 *   vive en el prompt de la skill, no aqui. Asi el codigo queda DRY, testeable y
 *   desacoplado de la evolucion del schema de CMC.
 *
 * Regla Castle Capital: el snapshot es INPUT EXTERNO. Se valida la forma y se
 * descartan packs malformados o `blocked` (igual que hace `normalizeItem`),
 * nunca se inventa una lectura.
 *
 * @typedef {object} CmcReading
 * @property {string|null} skill        unique_name de la skill (informativo)
 * @property {string} category          lane: overview|regime|macro|...
 * @property {string} coin              ticker en mayusculas, o 'MARKET'
 * @property {string} day               YYYY-MM-DD del snapshot (semilla de URL)
 * @property {string|null} asOf         ISO-UTC de la lectura
 * @property {('bullish'|'neutral'|'bearish'|null)} bias
 * @property {string} headline          titular legible (sin prefijo de coin)
 * @property {string} value             valor/estado conciso (puede ser '')
 * @property {string} interpretation    1-2 frases de interpretacion (es)
 */

/**
 * Lanes soportadas. Whitelist > blacklist: una categoria desconocida se ignora.
 * El set curado del plan mapea cada skill CMC a exactamente una de estas lanes.
 */
const CATEGORY_REGISTRY = {
  overview: { label: 'Resumen de mercado' },
  regime: { label: 'Régimen de mercado' },
  macro: { label: 'Macro' },
  crossasset: { label: 'Correlación cross-asset' },
  etf: { label: 'Flujos ETF' },
  derivatives: { label: 'Derivados / Perps' },
  technical: { label: 'Patrón técnico' },
  // Lanes opcionales (skills secundarias del plan):
  flows: { label: 'Flujos de exchange' },
  volatility: { label: 'Riesgo de volatilidad' },
  refuel: { label: 'Continuación de tendencia' },
};

const BIAS_VALUES = new Set(['bullish', 'neutral', 'bearish']);
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True si la categoria esta en la whitelist. */
function isSupportedCategory(category) {
  return typeof category === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_REGISTRY, category);
}

function isYmd(value) {
  return typeof value === 'string' && YMD_RE.test(value);
}

/** Deriva YYYY-MM-DD (UTC) de un ISO; null si invalido. */
function ymdFromIso(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/** Normaliza el bias a bullish|neutral|bearish; null si no reconocido. */
function normalizeBias(bias) {
  const s = String(bias || '').toLowerCase().trim();
  return BIAS_VALUES.has(s) ? s : null;
}

function asTrimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Aplana un bundle de snapshot a CmcReading[].
 * Tolerante a forma: descarta packs no-objeto, `blocked`, de categoria
 * desconocida, o sin titular/interpretacion. Nunca lanza.
 *
 * @param {object} bundle  { schema?, generatedAt?, date?, packs: [] }
 * @param {{ logger?: object, fallbackDate?: string }} [opts]
 * @returns {CmcReading[]}
 */
function extractReadings(bundle, opts = {}) {
  const logger = opts.logger || { warn() {}, debug() {} };
  if (!bundle || typeof bundle !== 'object') return [];

  const packs = Array.isArray(bundle.packs) ? bundle.packs : [];
  const day = isYmd(bundle.date)
    ? bundle.date
    : isYmd(opts.fallbackDate)
      ? opts.fallbackDate
      : ymdFromIso(bundle.generatedAt);
  if (!day) {
    logger.warn('cmc-extract: bundle sin fecha valida (date/generatedAt)');
    return [];
  }

  const readings = [];
  for (const pack of packs) {
    if (!pack || typeof pack !== 'object') continue;
    if (pack.blocked === true) continue;

    const category = asTrimmed(pack.category).toLowerCase();
    if (!isSupportedCategory(category)) continue;

    const headline = asTrimmed(pack.headline);
    const interpretation = asTrimmed(pack.interpretation);
    if (!headline || !interpretation) continue;

    const coin = asTrimmed(pack.coin) ? asTrimmed(pack.coin).toUpperCase() : 'MARKET';
    const asOf = asTrimmed(pack.asOf) || (typeof bundle.generatedAt === 'string' ? bundle.generatedAt : null);

    readings.push({
      skill: typeof pack.skill === 'string' ? pack.skill : null,
      category,
      coin,
      day,
      asOf,
      bias: normalizeBias(pack.bias),
      headline,
      value: asTrimmed(pack.value),
      interpretation,
    });
  }
  return readings;
}

module.exports = {
  CATEGORY_REGISTRY,
  isSupportedCategory,
  extractReadings,
  ymdFromIso,
  normalizeBias,
};
