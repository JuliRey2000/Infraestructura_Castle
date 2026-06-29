'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { ConfigError } = require('./errors');
const { parseDuration } = require('./duration');

/** Un id de tema/agente valido: minusculas, numeros y guiones. */
const TOPIC_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

// Raiz del tool: .../tools/news-extractor (este archivo vive en src/core/).
const TOOL_ROOT = path.resolve(__dirname, '..', '..');
// Raiz del repo: dos niveles arriba del tool (.../aios-core).
const REPO_ROOT = path.resolve(TOOL_ROOT, '..', '..');

const DEFAULT_SETTINGS = {
  output: { base_dir: 'docs/news-extractor', markdown: true, json: true },
  http: { timeout_ms: 15000, retries: 2, min_host_interval_ms: 1200 },
  notify: { telegram: { enabled: true } },
  schedule: { timezone: 'America/Bogota' },
  ai: { default_model: 'claude-sonnet-4-6' },
};

function getToolRoot() {
  return TOOL_ROOT;
}
function getRepoRoot() {
  return REPO_ROOT;
}

/** Lee y parsea un YAML de forma segura. Lanza ConfigError con contexto. */
function readYaml(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new ConfigError(`No se pudo leer config: ${path.basename(filePath)}`, {
      context: { file: filePath },
      cause: err,
    });
  }
  try {
    return yaml.load(text, { filename: filePath }) || {};
  } catch (err) {
    throw new ConfigError(`YAML invalido en ${path.basename(filePath)}: ${err.message}`, {
      context: { file: filePath },
      cause: err,
    });
  }
}

function deepMerge(base, override) {
  if (override == null) return base;
  if (Array.isArray(base) || Array.isArray(override)) return override;
  if (typeof base !== 'object' || typeof override !== 'object') return override;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    out[k] = k in base ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** Carga settings.yaml mergeado con defaults. Resuelve dirs absolutos. */
function loadSettings() {
  const file = path.join(TOOL_ROOT, 'config', 'settings.yaml');
  const raw = fs.existsSync(file) ? readYaml(file) : {};
  const settings = deepMerge(DEFAULT_SETTINGS, raw);
  const baseDir = settings.output.base_dir;
  settings.resolved = {
    toolRoot: TOOL_ROOT,
    repoRoot: REPO_ROOT,
    outputDir: path.isAbsolute(baseDir) ? baseDir : path.join(REPO_ROOT, baseDir),
  };
  return settings;
}

function assert(cond, message, context) {
  if (!cond) throw new ConfigError(message, { context });
}

/** Valida y normaliza un objeto brief crudo. */
function validateBrief(raw, sourceFile) {
  const ctx = { file: sourceFile };
  assert(raw && typeof raw === 'object', 'Brief vacio o no es un objeto', ctx);
  assert(raw.brief && typeof raw.brief === 'object', 'Falta el bloque "brief"', ctx);

  const id = raw.brief.id;
  assert(typeof id === 'string' && TOPIC_ID_RE.test(id), `id de brief invalido: ${id}`, ctx);

  const query = raw.query || {};
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const sources = Array.isArray(raw.sources) ? raw.sources : [];
  assert(sources.length > 0, `brief "${id}" no declara fuentes (sources)`, ctx);
  for (const s of sources) {
    assert(s && typeof s.type === 'string', `fuente sin "type" en brief "${id}"`, ctx);
  }

  // Validar que las duraciones sean parseables (lanza si no).
  const since = query.since || '24h';
  parseDuration(since, `${id}.query.since`);
  const dedup = raw.dedup || {};
  parseDuration(dedup.window || '48h', `${id}.dedup.window`);

  return {
    id,
    displayName: raw.brief.display_name || id,
    language: raw.brief.language || 'es',
    enabled: raw.brief.enabled !== false,
    query: {
      keywords: arr(query.keywords),
      tickers: arr(query.tickers),
      topics: arr(query.topics),
      since,
      maxItems: Number(query.max_items) > 0 ? Number(query.max_items) : 30,
    },
    sources: sources.map((s) => ({ type: s.type, options: s.options || {} })),
    dedup: {
      strategy: dedup.strategy || 'both', // url | title | both
      window: dedup.window || '48h',
    },
    agents: Array.isArray(raw.agents) ? raw.agents.filter((a) => typeof a === 'string') : [],
    schedule: {
      cron: (raw.schedule && raw.schedule.cron) || null,
      timezone: (raw.schedule && raw.schedule.timezone) || 'America/Bogota',
    },
    output: {
      markdown: !(raw.output && raw.output.markdown === false),
      json: !(raw.output && raw.output.json === false),
    },
    notify: {
      telegram: !!(raw.notify && raw.notify.telegram),
    },
    sourceFile,
  };
}

function briefsDir() {
  return path.join(TOOL_ROOT, 'config', 'briefs');
}

/** Lista los paths de archivos de brief (.yaml/.yml). */
function listBriefFiles() {
  const dir = briefsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(ya?ml)$/i.test(f))
    .map((f) => path.join(dir, f))
    .sort();
}

/** Carga y valida todos los briefs. */
function loadAllBriefs() {
  return listBriefFiles().map((file) => validateBrief(readYaml(file), file));
}

/** Carga un brief por id. Lanza ConfigError si no existe. */
function loadBriefById(id) {
  assert(TOPIC_ID_RE.test(String(id)), `id de tema invalido: ${id}`, { id });
  for (const file of listBriefFiles()) {
    const brief = validateBrief(readYaml(file), file);
    if (brief.id === id) return brief;
  }
  throw new ConfigError(`Tema no encontrado: ${id}`, { context: { id } });
}

module.exports = {
  TOPIC_ID_RE,
  DEFAULT_SETTINGS,
  getToolRoot,
  getRepoRoot,
  loadSettings,
  loadAllBriefs,
  loadBriefById,
  listBriefFiles,
  validateBrief,
  readYaml,
  briefsDir,
};
