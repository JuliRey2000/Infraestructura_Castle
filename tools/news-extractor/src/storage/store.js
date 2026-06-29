'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Escrituras atomicas (tmp + rename) y lecturas defensivas. Toda escritura
 * crea el directorio padre si no existe. rename es atomico en el mismo fs.
 */

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Escribe un archivo de forma atomica: tmp en el mismo dir + rename. */
function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  fs.writeFileSync(tmp, content, { mode: 0o644 });
  try {
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* limpieza best-effort */
    }
    throw err;
  }
  return filePath;
}

function writeJsonAtomic(filePath, obj) {
  return writeFileAtomic(filePath, `${JSON.stringify(obj, null, 2)}\n`);
}

/** Lee y parsea JSON; devuelve `fallback` si no existe o esta corrupto. */
function readJson(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readText(filePath, fallback = null) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

/** Anade una linea JSON a un archivo .jsonl (append-only). */
function appendJsonl(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(obj)}\n`);
  return filePath;
}

/** Lee las ultimas N lineas de un .jsonl, parseadas. */
function readJsonlTail(filePath, limit = 50) {
  const text = readText(filePath, '');
  if (!text) return [];
  const lines = text.split('\n').filter((l) => l.trim());
  const slice = limit > 0 ? lines.slice(-limit) : lines;
  const out = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line));
    } catch {
      /* ignora lineas corruptas */
    }
  }
  return out;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

module.exports = {
  ensureDir,
  writeFileAtomic,
  writeJsonAtomic,
  readJson,
  readText,
  appendJsonl,
  readJsonlTail,
  exists,
};
