'use strict';

const crypto = require('crypto');
const { HttpError } = require('./errors');
const baseLogger = require('./logger');

/**
 * Cliente HTTP sobre `fetch` nativo (Node >=18). Zero-dep.
 *
 * Garantias de seguridad Castle Capital:
 *  - HTTPS obligatorio: rechaza cualquier URL no-https salvo loopback.
 *  - Timeout por request (AbortController).
 *  - Retry con backoff exponencial + jitter en errores de red / 429 / 5xx.
 *  - Rate limiting por host (intervalo minimo entre requests al mismo host).
 *  - Nunca traga errores: lanza HttpError con contexto (sin secretos).
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function isHttpsOrLoopback(parsed) {
  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol === 'http:') return LOOPBACK_HOSTS.has(parsed.hostname);
  return false;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        },
        { once: true },
      );
    }
  });
}

/** Combina un timeout con una signal externa opcional. */
function buildSignal(timeoutMs, external) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!external) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, external]);
  }
  return external; // fallback degradado
}

class HttpClient {
  /**
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs] timeout por request
   * @param {number} [opts.retries] reintentos en error transitorio
   * @param {number} [opts.minHostIntervalMs] rate limit: ms minimos entre llamadas al mismo host
   * @param {string} [opts.userAgent]
   * @param {object} [opts.logger]
   */
  constructor(opts = {}) {
    this.timeoutMs = opts.timeoutMs || 15000;
    this.retries = opts.retries != null ? opts.retries : 2;
    this.minHostIntervalMs = opts.minHostIntervalMs || 0;
    this.userAgent = opts.userAgent || 'castle-news-extractor/1.0 (+https://castlecapital)';
    this.logger = opts.logger || baseLogger;
    /** @type {Map<string, number>} ultimo timestamp de request por host */
    this._lastHostHit = new Map();
  }

  async _throttle(host, signal) {
    if (!this.minHostIntervalMs) return;
    const last = this._lastHostHit.get(host) || 0;
    const wait = last + this.minHostIntervalMs - Date.now();
    if (wait > 0) await sleep(wait, signal);
    this._lastHostHit.set(host, Date.now());
  }

  /**
   * Request crudo con retry/backoff. Devuelve el Response (ok garantizado).
   * @param {string} url
   * @param {object} [options] fetch options + { timeoutMs, retries, signal }
   * @returns {Promise<Response>}
   */
  async request(url, options = {}) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpError('URL invalida', { context: { url: String(url).slice(0, 120) } });
    }
    if (!isHttpsOrLoopback(parsed)) {
      throw new HttpError('Bloqueado: URL no-HTTPS (solo se permite https o loopback)', {
        context: { url: `${parsed.protocol}//${parsed.hostname}` },
      });
    }

    const retries = options.retries != null ? options.retries : this.retries;
    const timeoutMs = options.timeoutMs || this.timeoutMs;
    const headers = {
      'user-agent': this.userAgent,
      accept: 'application/json, text/xml, application/xml, */*',
      ...(options.headers || {}),
    };

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await this._throttle(parsed.host, options.signal);
      const signal = buildSignal(timeoutMs, options.signal);
      try {
        const res = await fetch(url, { ...options, headers, signal });
        if (res.ok) return res;

        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
        if (retryable && attempt < retries) {
          const backoff = this._backoff(attempt, res.headers.get('retry-after'));
          this.logger.warn('HTTP reintentable, esperando', {
            host: parsed.host,
            status: res.status,
            attempt: attempt + 1,
            backoffMs: backoff,
          });
          await sleep(backoff, options.signal);
          attempt += 1;
          continue;
        }
        // Consumir el body para liberar el socket; contenido irrelevante en error (ignorar a proposito).
        await res.text().catch(() => {});
        throw new HttpError(`HTTP ${res.status} ${res.statusText}`, {
          context: { host: parsed.host, status: res.status },
        });
      } catch (err) {
        if (err instanceof HttpError) throw err;
        const isAbort = err && (err.name === 'AbortError' || err.name === 'TimeoutError');
        if (attempt < retries) {
          const backoff = this._backoff(attempt);
          this.logger.warn('Error de red, reintentando', {
            host: parsed.host,
            error: err && err.message,
            attempt: attempt + 1,
            backoffMs: backoff,
          });
          // Abort durante el backoff: el proximo intento fallara rapido con la signal (ignorar aqui a proposito).
          await sleep(backoff, options.signal).catch(() => {});
          attempt += 1;
          continue;
        }
        throw new HttpError(isAbort ? 'Timeout/abort de request' : 'Fallo de red', {
          context: { host: parsed.host },
          cause: err,
        });
      }
    }
  }

  _backoff(attempt, retryAfterHeader) {
    if (retryAfterHeader) {
      const secs = Number(retryAfterHeader);
      if (Number.isFinite(secs) && secs > 0) return Math.min(secs * 1000, 30000);
    }
    const base = 500 * 2 ** attempt; // 500, 1000, 2000, ...
    // Jitter operacional (no-seguridad); crypto.randomInt por estandar Castle Capital.
    const jitter = crypto.randomInt(250);
    return Math.min(base + jitter, 15000);
  }

  /** GET que parsea JSON. */
  async getJson(url, options = {}) {
    const res = await this.request(url, { ...options, method: 'GET' });
    try {
      return await res.json();
    } catch (err) {
      throw new HttpError('Respuesta no es JSON valido', {
        context: { host: new URL(url).host },
        cause: err,
      });
    }
  }

  /** GET que devuelve texto (para RSS/XML). */
  async getText(url, options = {}) {
    const res = await this.request(url, { ...options, method: 'GET' });
    return res.text();
  }

  /** POST JSON -> JSON (usado por notify/telegram y agente IA). */
  async postJson(url, body, options = {}) {
    const res = await this.request(url, {
      ...options,
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(body),
    });
    try {
      return await res.json();
    } catch (err) {
      throw new HttpError('Respuesta POST no es JSON valido', {
        context: { host: new URL(url).host },
        cause: err,
      });
    }
  }
}

module.exports = { HttpClient, isHttpsOrLoopback, LOOPBACK_HOSTS };
