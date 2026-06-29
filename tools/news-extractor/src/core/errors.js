'use strict';

/**
 * Errores tipados del news-extractor.
 *
 * Regla Castle Capital: nunca tragar excepciones silenciosamente. Cada capa
 * lanza un error tipado con contexto suficiente para loguear y degradar con
 * elegancia (un fallo de fuente/agente no debe tumbar el run completo).
 */

/** Error base con codigo y contexto estructurado (sin secretos). */
class NewsError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, context?: object, cause?: unknown }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code || 'NEWS_ERROR';
    this.context = opts.context || {};
    if (opts.cause !== undefined) this.cause = opts.cause;
  }

  /** Representacion serializable para logs/run-history (sin secretos). */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

/** Fallo al cargar o validar configuracion (settings, briefs, manifiestos). */
class ConfigError extends NewsError {
  constructor(message, opts = {}) {
    super(message, { code: 'CONFIG_ERROR', ...opts });
  }
}

/** Fallo de una fuente de noticias (fetch/parse/mapeo del proveedor). */
class SourceError extends NewsError {
  constructor(message, opts = {}) {
    super(message, { code: 'SOURCE_ERROR', ...opts });
  }
}

/** Fallo de un agente pluggable (transport, timeout, output invalido). */
class AgentError extends NewsError {
  constructor(message, opts = {}) {
    super(message, { code: 'AGENT_ERROR', ...opts });
  }
}

/** Fallo de red/HTTP (status no-ok, timeout, url no-https). */
class HttpError extends NewsError {
  constructor(message, opts = {}) {
    super(message, { code: 'HTTP_ERROR', ...opts });
  }
}

/** Fallo de validacion de input externo (item malformado, schema). */
class ValidationError extends NewsError {
  constructor(message, opts = {}) {
    super(message, { code: 'VALIDATION_ERROR', ...opts });
  }
}

module.exports = {
  NewsError,
  ConfigError,
  SourceError,
  AgentError,
  HttpError,
  ValidationError,
};
