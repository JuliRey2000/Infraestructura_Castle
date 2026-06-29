'use strict';

const { validateAdapter } = require('./base-source');
const { ConfigError } = require('../core/errors');

/**
 * Registro de adaptadores de fuente.
 *
 * Agregar una fuente nueva = crear src/sources/<name>.js (con el contrato de
 * base-source.js) y anadir UNA linea aqui. El core no cambia.
 */
const ADAPTERS = {
  rss: require('./rss'),
  coingecko: require('./coingecko'),
  marketaux: require('./marketaux'),
  alphavantage: require('./alphavantage'),
  finnhub: require('./finnhub'),
  cmc: require('./cmc'),
};

// Validacion temprana del contrato de cada adaptador registrado.
for (const [name, mod] of Object.entries(ADAPTERS)) {
  validateAdapter(mod, name);
}

/** Devuelve el adaptador para un type. Lanza ConfigError si no existe. */
function getSource(type) {
  const mod = ADAPTERS[type];
  if (!mod) {
    throw new ConfigError(`Fuente desconocida: "${type}". Disponibles: ${listTypes().join(', ')}`, {
      context: { type },
    });
  }
  return mod;
}

/** Lista los types registrados. */
function listTypes() {
  return Object.keys(ADAPTERS);
}

/** Metadata de cada fuente (sin exponer valores de keys). */
function describeSources() {
  return listTypes().map((type) => {
    const mod = ADAPTERS[type];
    const hasKey = !mod.requiresKey || !!process.env[mod.envKey];
    return {
      type,
      requiresKey: !!mod.requiresKey,
      envKey: mod.envKey || null,
      keyPresent: hasKey,
    };
  });
}

/** Permite registrar/intercambiar un adaptador en runtime (tests, plugins). */
function registerSource(type, mod) {
  ADAPTERS[type] = validateAdapter(mod, type);
}

module.exports = { getSource, listTypes, describeSources, registerSource };
