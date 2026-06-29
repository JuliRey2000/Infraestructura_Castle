'use strict';

const { AgentError } = require('../../core/errors');

/**
 * Transport HTTP: POST del AgentInput a un endpoint local (http loopback o https).
 * El HttpClient ya rechaza http:// no-loopback. Pensado para agentes corriendo
 * como servicio local o gateway MCP. (Fase 2)
 *
 * Manifiesto:
 *   transport: { type: http, url: "http://127.0.0.1:8799/analyze", timeout_ms: 60000 }
 */
async function invokeHttp({ manifest, input, ctx }) {
  const t = manifest.transport || {};
  const url = t.url;
  if (typeof url !== 'string' || !url) {
    throw new AgentError('Manifiesto invalido: transport.url ausente', {
      context: { agentId: manifest.agent && manifest.agent.id },
    });
  }
  if (!ctx.http) {
    throw new AgentError('Transport http requiere un cliente http en ctx', {
      context: { agentId: manifest.agent && manifest.agent.id },
    });
  }
  const timeoutMs = Number(t.timeout_ms) > 0 ? Number(t.timeout_ms) : 60000;
  try {
    return await ctx.http.postJson(url, input, {
      timeoutMs,
      retries: 1,
      signal: ctx.signal,
      headers: t.headers || {},
    });
  } catch (err) {
    throw new AgentError('Transport http fallo', {
      context: { agentId: manifest.agent && manifest.agent.id, url: new URL(url).host },
      cause: err,
    });
  }
}

module.exports = { invokeHttp, type: 'http' };
