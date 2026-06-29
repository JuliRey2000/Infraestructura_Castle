'use strict';

/**
 * Logger estructurado. Escribe SIEMPRE a stderr para mantener stdout limpio
 * (stdout se reserva para output de datos: JSON de agentes, briefs, etc.).
 *
 * Nunca traga errores. Enmascara secretos antes de imprimir.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

const ENV_LEVEL =
  (process.env.NEWS_LOG_LEVEL || (process.env.AIOX_DEBUG === 'true' ? 'debug' : 'info'))
    .toLowerCase();

const ACTIVE_LEVEL = LEVELS[ENV_LEVEL] != null ? LEVELS[ENV_LEVEL] : LEVELS.info;

// Patrones de secretos a enmascarar en cualquier string logueado.
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g, // Anthropic
  /\b\d{6,}:[A-Za-z0-9_-]{30,}\b/g, // Telegram bot token
  /\bbearer\s+[A-Za-z0-9._-]{12,}/gi, // bearer tokens
  /\b0x[a-fA-F0-9]{40}\b/g, // wallets EVM -> ultimos 4
];

/** Enmascara secretos conocidos en un string. */
function maskString(str) {
  let out = String(str);
  out = out.replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-***');
  out = out.replace(/\b(\d{6,}):[A-Za-z0-9_-]{30,}\b/g, '$1:***');
  out = out.replace(/\b(bearer)\s+[A-Za-z0-9._-]{12,}/gi, '$1 ***');
  out = out.replace(/\b0x[a-fA-F0-9]{36}([a-fA-F0-9]{4})\b/g, '0x...$1');
  return out;
}

/** Enmascara recursivamente strings dentro de un objeto serializable. */
function maskValue(value, seen = new WeakSet()) {
  if (typeof value === 'string') return maskString(value);
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => maskValue(v, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    // Campos cuyo NOMBRE sugiere secreto: ocultar valor por completo.
    if (/key|token|secret|password|authorization|apikey/i.test(k)) {
      out[k] = '***';
    } else {
      out[k] = maskValue(v, seen);
    }
  }
  return out;
}

function emit(level, message, meta) {
  if (LEVELS[level] < ACTIVE_LEVEL) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: maskString(message),
  };
  if (meta && Object.keys(meta).length > 0) entry.meta = maskValue(meta);
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

const logger = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
  /** Crea un logger hijo con contexto fijo (ej: { topic, source }). */
  child(fixed) {
    return {
      debug: (m, meta) => emit('debug', m, { ...fixed, ...meta }),
      info: (m, meta) => emit('info', m, { ...fixed, ...meta }),
      warn: (m, meta) => emit('warn', m, { ...fixed, ...meta }),
      error: (m, meta) => emit('error', m, { ...fixed, ...meta }),
      child: (more) => logger.child({ ...fixed, ...more }),
    };
  },
  maskString,
  maskValue,
};

module.exports = logger;
