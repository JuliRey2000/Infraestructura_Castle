'use strict';

const path = require('path');
const { ValidationError } = require('../core/errors');

/**
 * Resolucion de rutas de SALIDA, acotada a `outputDir` (docs/news-extractor/).
 * Guards contra path traversal y validacion de ids/fechas.
 */

const TOPIC_RE = /^[a-z0-9][a-z0-9-]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertTopic(topic) {
  if (typeof topic !== 'string' || !TOPIC_RE.test(topic)) {
    throw new ValidationError(`Topic id invalido: ${topic}`, { context: { topic } });
  }
  return topic;
}

function assertDate(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    throw new ValidationError(`Fecha invalida (YYYY-MM-DD): ${date}`, { context: { date } });
  }
  return date;
}

/** Fecha local (zona del sistema) en YYYY-MM-DD. */
function today(tz) {
  // Si se da timezone, usar Intl para la fecha local de esa zona.
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      if (DATE_RE.test(parts)) return parts;
    } catch {
      /* zona invalida -> fallback */
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Crea un resolvedor de paths atado a un outputDir absoluto.
 * @param {string} outputDir
 */
function createPaths(outputDir) {
  const base = path.resolve(outputDir);

  /** Garantiza que `target` quede DENTRO de base (anti path-traversal). */
  function safeJoin(...segments) {
    const target = path.resolve(base, ...segments);
    const rel = path.relative(base, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new ValidationError('Path fuera del directorio de salida (traversal bloqueado)', {
        context: { base, target },
      });
    }
    return target;
  }

  return {
    base,
    outputDir: base,
    briefsRoot: () => safeJoin('briefs'),
    briefDir: (topic) => safeJoin('briefs', assertTopic(topic)),
    briefFile: (topic, date) => safeJoin('briefs', assertTopic(topic), `${assertDate(date)}.md`),
    dataDir: (topic) => safeJoin('data', assertTopic(topic)),
    itemsFile: (topic, date) =>
      safeJoin('data', assertTopic(topic), `${assertDate(date)}.items.json`),
    analysisFile: (topic, date) =>
      safeJoin('data', assertTopic(topic), `${assertDate(date)}.analysis.json`),
    runHistoryFile: () => safeJoin('runs', 'run-history.jsonl'),
    dedupIndexFile: () => safeJoin('.dedup-index.json'),
    safeJoin,
  };
}

module.exports = { createPaths, today, assertTopic, assertDate, TOPIC_RE, DATE_RE };
