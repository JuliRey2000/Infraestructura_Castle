'use strict';

const { AgentError } = require('../core/errors');
const { invokeCliSubprocess } = require('./transports/cli-subprocess');
const { invokeHttp } = require('./transports/http');
const { invokeAioxSquad } = require('./transports/aiox-squad');

/**
 * Connector: dispatcher transport-agnostic. Arma el AgentInput, elige el
 * transport segun el manifiesto, invoca, valida el AgentOutput y lo normaliza.
 *
 * El core NUNCA importa logica del agente: solo el manifiesto + dos schemas + un
 * transport. Si algo falla, lanza AgentError (el runner degrada con elegancia).
 */

const TRANSPORTS = {
  cli: invokeCliSubprocess,
  http: invokeHttp,
  'aiox-squad': invokeAioxSquad,
};

/** Permite registrar un transport nuevo (extensibilidad). */
function registerTransport(type, fn) {
  TRANSPORTS[type] = fn;
}

const VALID_LABELS = new Set(['bullish', 'neutral', 'bearish']);
const VALID_DIRS = new Set(['bullish', 'bearish', 'neutral']);

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Valida y normaliza el AgentOutput crudo contra el contrato. Lanza AgentError
 * si es estructuralmente invalido (sin summary, agentId, etc.).
 */
function validateAgentOutput(raw, expectedAgentId) {
  if (!raw || typeof raw !== 'object') {
    throw new AgentError('AgentOutput no es un objeto', { context: { agentId: expectedAgentId } });
  }
  if (raw.schemaVersion && raw.schemaVersion !== '1.0') {
    throw new AgentError(`schemaVersion no soportada: ${raw.schemaVersion}`, {
      context: { agentId: expectedAgentId },
    });
  }
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) {
    throw new AgentError('AgentOutput sin "summary" valido', {
      context: { agentId: expectedAgentId },
    });
  }
  const agentId = typeof raw.agentId === 'string' && raw.agentId ? raw.agentId : expectedAgentId;

  let sentiment = null;
  if (raw.sentiment && typeof raw.sentiment === 'object') {
    const score = Number(raw.sentiment.score);
    if (Number.isFinite(score)) {
      let label = String(raw.sentiment.label || '').toLowerCase();
      if (!VALID_LABELS.has(label)) {
        label = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral';
      }
      sentiment = { score: Number(clamp(score, -1, 1).toFixed(3)), label };
    }
  }

  const signals = Array.isArray(raw.signals)
    ? raw.signals
        .filter((s) => s && typeof s.label === 'string')
        .slice(0, 20)
        .map((s) => ({
          label: String(s.label).slice(0, 120),
          direction: VALID_DIRS.has(String(s.direction)) ? s.direction : 'neutral',
          confidence: Number.isFinite(Number(s.confidence)) ? clamp(Number(s.confidence), 0, 1) : undefined,
          rationale: typeof s.rationale === 'string' ? s.rationale.slice(0, 400) : undefined,
          refs: Array.isArray(s.refs) ? s.refs.filter((r) => typeof r === 'string').slice(0, 10) : undefined,
        }))
    : [];

  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights
        .filter((h) => h && typeof h.itemId === 'string')
        .slice(0, 20)
        .map((h) => ({
          itemId: String(h.itemId),
          why: typeof h.why === 'string' ? h.why.slice(0, 300) : '',
          importance: Number.isInteger(h.importance) ? clamp(h.importance, 1, 5) : undefined,
        }))
    : [];

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w) => typeof w === 'string').slice(0, 10).map((w) => w.slice(0, 300))
    : [];

  return { schemaVersion: '1.0', agentId, summary: raw.summary.trim(), sentiment, signals, highlights, warnings };
}

/**
 * Construye el AgentInput estandar (sin secretos, sin raw) para un brief + items.
 * @param {object} args
 * @returns {object} AgentInput
 */
function buildAgentInput({ brief, items, runId, context }) {
  return {
    schemaVersion: '1.0',
    brief: {
      id: brief.id,
      display_name: brief.displayName || brief.id,
      language: brief.language || 'es',
      query: {
        keywords: brief.query.keywords || [],
        tickers: brief.query.tickers || [],
        topics: brief.query.topics || [],
      },
    },
    runId,
    items, // ya vienen sin .raw (responsabilidad del runner)
    context: context || {},
  };
}

/**
 * Ejecuta un agente: dispatch -> invoke -> validate -> normalize.
 * @param {object} args
 * @param {object} args.manifest   manifiesto normalizado (registry)
 * @param {object} args.input      AgentInput
 * @param {object} args.ctx        { logger, signal, toolRoot, http }
 * @returns {Promise<object>} AgentOutput normalizado (+ displayName)
 */
async function runAgent({ manifest, input, ctx }) {
  const type = manifest.transport && manifest.transport.type;
  const transport = TRANSPORTS[type];
  if (!transport) {
    throw new AgentError(`Transport desconocido: ${type}`, {
      context: { agentId: manifest.agent && manifest.agent.id },
    });
  }
  const t0 = Date.now();
  const raw = await transport({ manifest, input, ctx });
  const output = validateAgentOutput(raw, manifest.agent.id);
  output.displayName = manifest.agent.displayName;
  output.durationMs = Date.now() - t0;
  return output;
}

module.exports = {
  runAgent,
  buildAgentInput,
  validateAgentOutput,
  registerTransport,
  TRANSPORTS,
};
