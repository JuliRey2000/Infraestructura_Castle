'use strict';

const fs = require('fs');
const path = require('path');
const { getToolRoot } = require('./config-loader');

/**
 * Cargador .env minimo (zero-dep). Lee tools/news-extractor/.env y popula
 * process.env SIN sobrescribir variables ya definidas (las del entorno ganan).
 * Necesario para runs agendados por launchd, que no heredan el env del shell.
 */
function loadEnv(envPath) {
  const file = envPath || path.join(getToolRoot(), '.env');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { loaded: false, file, count: 0 };
  }
  let count = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
      count += 1;
    }
  }
  return { loaded: true, file, count };
}

module.exports = { loadEnv };
