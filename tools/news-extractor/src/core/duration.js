'use strict';

const { ConfigError } = require('./errors');

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Convierte una duracion tipo "24h", "48h", "7d", "30m" a milisegundos.
 * @param {string} value
 * @param {string} [fieldName] para mensajes de error
 * @returns {number}
 */
function parseDuration(value, fieldName = 'duration') {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = /^(\d+)\s*([smhdw])$/.exec(String(value).trim().toLowerCase());
  if (!match) {
    throw new ConfigError(`Valor de duracion invalido en "${fieldName}": ${value}`, {
      context: { field: fieldName, value },
    });
  }
  return Number(match[1]) * UNIT_MS[match[2]];
}

/** Devuelve un timestamp (ms) "hace N" a partir de una duracion. */
function sinceTimestamp(value, fieldName) {
  return Date.now() - parseDuration(value, fieldName);
}

module.exports = { parseDuration, sinceTimestamp, UNIT_MS };
