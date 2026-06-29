'use strict';

const fs = require('fs');
const path = require('path');
const { readYaml, TOPIC_ID_RE, getToolRoot } = require('../core/config-loader');
const { ConfigError } = require('../core/errors');
const store = require('../storage/store');
const baseLogger = require('../core/logger');

/**
 * Registro de agentes pluggables. Carga config/agents/manifests/*.yaml, valida
 * el contrato minimo del manifiesto, y aplica un override de enable/disable
 * persistido en un state file (runtime, gitignored).
 */

const KNOWN_TRANSPORTS = new Set(['cli', 'http', 'aiox-squad']);

function manifestsDir() {
  return path.join(getToolRoot(), 'config', 'agents', 'manifests');
}

function validateManifest(raw, sourceFile) {
  const ctx = { file: sourceFile };
  if (!raw || typeof raw !== 'object' || !raw.agent) {
    throw new ConfigError('Manifiesto sin bloque "agent"', { context: ctx });
  }
  const id = raw.agent.id;
  if (typeof id !== 'string' || !TOPIC_ID_RE.test(id)) {
    throw new ConfigError(`id de agente invalido: ${id}`, { context: ctx });
  }
  const t = raw.transport || {};
  if (!KNOWN_TRANSPORTS.has(t.type)) {
    throw new ConfigError(
      `transport.type invalido en "${id}": ${t.type}. Validos: ${[...KNOWN_TRANSPORTS].join(', ')}`,
      { context: ctx },
    );
  }
  return {
    agent: {
      id,
      displayName: raw.agent.display_name || id,
      version: raw.agent.version || '1.0.0',
      enabled: raw.agent.enabled !== false,
      language: raw.agent.language || 'es',
    },
    transport: {
      type: t.type,
      command: t.command || null,
      args: Array.isArray(t.args) ? t.args : [],
      cwd: t.cwd || '.',
      timeout_ms: Number(t.timeout_ms) > 0 ? Number(t.timeout_ms) : 60000,
      url: t.url || null,
      headers: t.headers || {},
      agent: t.agent || null,
      model: t.model || null,
    },
    io: raw.io || {},
    applies_to: Array.isArray(raw.applies_to) ? raw.applies_to : [],
    sourceFile,
  };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.stateFile] ruta del override enable/disable (runtime)
 * @param {object} [opts.logger]
 */
function createRegistry(opts = {}) {
  const logger = opts.logger || baseLogger;
  const stateFile = opts.stateFile || null;

  function loadState() {
    if (!stateFile) return {};
    return store.readJson(stateFile, {}) || {};
  }
  function saveState(state) {
    if (!stateFile) return;
    store.writeJsonAtomic(stateFile, state);
  }

  function listFiles() {
    const dir = manifestsDir();
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(ya?ml)$/i.test(f))
      .map((f) => path.join(dir, f))
      .sort();
  }

  /** Devuelve todos los manifiestos (con enabled efectivo tras override). */
  function list() {
    const state = loadState();
    return listFiles().map((file) => {
      const m = validateManifest(readYaml(file), file);
      if (Object.prototype.hasOwnProperty.call(state, m.agent.id)) {
        m.agent.enabled = !!state[m.agent.id];
      }
      return m;
    });
  }

  function get(id) {
    return list().find((m) => m.agent.id === id) || null;
  }

  function setEnabled(id, enabled) {
    const m = get(id);
    if (!m) throw new ConfigError(`Agente no encontrado: ${id}`, { context: { id } });
    const state = loadState();
    state[id] = !!enabled;
    saveState(state);
    logger.info('Estado de agente actualizado', { agentId: id, enabled: !!enabled });
    return { ...m, agent: { ...m.agent, enabled: !!enabled } };
  }

  /** Manifiestos habilitados que aplican a un brief dado. */
  function enabledFor(briefId, requestedIds) {
    return list().filter((m) => {
      if (!m.agent.enabled) return false;
      if (Array.isArray(requestedIds) && requestedIds.length && !requestedIds.includes(m.agent.id)) {
        return false;
      }
      if (m.applies_to.length && !m.applies_to.includes(briefId)) return false;
      return true;
    });
  }

  return { list, get, setEnabled, enabledFor, validateManifest };
}

module.exports = { createRegistry, validateManifest, KNOWN_TRANSPORTS };
