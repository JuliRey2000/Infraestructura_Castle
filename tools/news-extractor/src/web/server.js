'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const baseLogger = require('../core/logger');
const api = require('./api');

/**
 * Servidor web LOCAL (Fase 3). Fino, sobre node:http (stdlib, sin express).
 * Cada endpoint delega en la MISMA funcion de core que el CLI (ver api.js).
 *
 * Seguridad: bind 127.0.0.1, rechaza Host no-loopback, sin listado de dirs,
 * limite de tamano de request, whitelist de archivos estaticos. Por CLI-First,
 * el server es OPCIONAL: todo funciona sin el.
 */

const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 64 * 1024;

const STATIC = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/app.css': { file: 'app.css', type: 'text/css; charset=utf-8' },
};

const LOOPBACK = /^(127\.0\.0\.1|localhost|\[::1\]|::1)(:\d+)?$/i;

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('request demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('body no es JSON valido'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, pathname) {
  const entry = STATIC[pathname];
  if (!entry) return send(res, 404, { error: 'no encontrado' });
  const file = path.join(PUBLIC_DIR, entry.file);
  // Guard: el archivo resuelto debe quedar dentro de PUBLIC_DIR.
  if (!path.resolve(file).startsWith(path.resolve(PUBLIC_DIR))) {
    return send(res, 403, { error: 'prohibido' });
  }
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'no encontrado' });
    res.writeHead(200, { 'content-type': entry.type, 'cache-control': 'no-store' });
    res.end(data);
  });
}

async function route(req, res, logger) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const seg = url.pathname.split('/').filter(Boolean);
  const method = req.method;

  // --- API ---
  if (seg[0] === 'api') {
    try {
      // /api/health
      if (seg[1] === 'health' && method === 'GET') return send(res, ...resp(api.health()));
      // /api/settings
      if (seg[1] === 'settings' && method === 'GET') return send(res, ...resp(api.settings()));
      // /api/topics ...
      if (seg[1] === 'topics') {
        if (seg.length === 2 && method === 'GET') return send(res, ...resp(api.listTopics()));
        if (seg.length === 3 && method === 'GET') return send(res, ...resp(api.getTopic(seg[2])));
        if (seg.length === 4 && seg[3] === 'run' && method === 'POST') {
          const body = await readBody(req);
          return send(res, ...resp(await api.runTopic(seg[2], body)));
        }
      }
      // /api/briefs/:topic[/:date]
      if (seg[1] === 'briefs' && method === 'GET' && seg[2]) {
        return send(res, ...resp(api.getBrief(seg[2], seg[3])));
      }
      // /api/agents ...
      if (seg[1] === 'agents') {
        if (seg.length === 2 && method === 'GET') return send(res, ...resp(api.listAgents()));
        if (seg.length === 4 && method === 'POST' && (seg[3] === 'enable' || seg[3] === 'disable')) {
          return send(res, ...resp(api.setAgent(seg[2], seg[3] === 'enable')));
        }
      }
      // /api/history
      if (seg[1] === 'history' && method === 'GET') {
        return send(res, ...resp(api.history(url.searchParams.get('topic'), Number(url.searchParams.get('limit')))));
      }
      return send(res, 404, { error: 'endpoint no encontrado' });
    } catch (err) {
      logger.warn('API error', { path: url.pathname, error: err.message });
      return send(res, 400, { error: err.message });
    }
  }

  // --- Estatico ---
  if (method === 'GET') return serveStatic(res, url.pathname);
  return send(res, 405, { error: 'metodo no permitido' });
}

/** Convierte { status, body } -> args de send(). */
function resp(r) {
  return [r.status, r.body];
}

/**
 * Inicia el servidor. Bind 127.0.0.1, rechaza Host no-loopback.
 * @returns {Promise<import('http').Server>}
 */
function startServer({ port = 8730, logger = baseLogger } = {}) {
  const server = http.createServer((req, res) => {
    const host = req.headers.host || '';
    if (!LOOPBACK.test(host)) {
      logger.warn('Host no-loopback rechazado', { host });
      return send(res, 403, { error: 'solo loopback' });
    }
    route(req, res, logger).catch((err) => {
      logger.error('Error no manejado en route', { error: err.message });
      if (!res.headersSent) send(res, 500, { error: 'error interno' });
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      logger.info('Web UI escuchando', { url: `http://127.0.0.1:${port}` });
      resolve(server);
    });
  });
}

module.exports = { startServer };
