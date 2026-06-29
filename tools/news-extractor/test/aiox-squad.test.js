'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const connector = require('../src/agents/connector');
const { getToolRoot } = require('../src/core/config-loader');
const { AgentError } = require('../src/core/errors');

const silent = { debug() {}, info() {}, warn() {}, error() {}, child() { return silent; } };

const FAKE_CLAUDE = path.join(getToolRoot(), 'test', 'fixtures', 'fake-claude.js');
let expertsRoot;

function manifest(expertId, overrides = {}) {
  return {
    agent: { id: expertId, displayName: 'Experto Test' },
    transport: {
      type: 'aiox-squad',
      agent: expertId,
      command: FAKE_CLAUDE, // ejecutable directo (shebang); ignora flags de claude
      args: [],
      timeout_ms: 120000,
      ...overrides,
    },
  };
}

function input(items) {
  return connector.buildAgentInput({
    brief: { id: 'crypto', displayName: 'Cripto', language: 'es', query: { keywords: ['btc'], tickers: [], topics: [] } },
    items,
    runId: 'test#crypto',
    context: {},
  });
}

before(() => {
  expertsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'news-experts-'));
  process.env.NEWS_EXPERTS_DIR = expertsRoot;
  const dir = path.join(expertsRoot, 'crypto-x');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'persona.md'), '# Persona\nEres un analista cripto de prueba.\n');
  fs.chmodSync(FAKE_CLAUDE, 0o755);
});

after(() => {
  delete process.env.NEWS_EXPERTS_DIR;
  try { fs.rmSync(expertsRoot, { recursive: true, force: true }); } catch { /* noop */ }
});

test('aiox-squad: round-trip via claude simulado (envelope + fence)', async () => {
  const out = await connector.runAgent({
    manifest: manifest('crypto-x'),
    input: input([{ id: 'item-1', title: 'BTC rompe resistencia', url: 'https://x.co/a' }]),
    ctx: { logger: silent, toolRoot: getToolRoot() },
  });
  assert.strictEqual(out.agentId, 'crypto-x'); // lo completa el connector desde el manifiesto
  assert.strictEqual(out.summary, 'fake-claude ok');
  assert.deepStrictEqual(out.sentiment, { score: 0.2, label: 'bullish' });
  assert.strictEqual(out.signals[0].direction, 'bullish');
});

test('aiox-squad: items vacios -> output minimal SIN invocar a claude', async () => {
  const out = await connector.runAgent({
    manifest: manifest('crypto-x', { command: '/bin/false' }), // si invocara, fallaria
    input: input([]),
    ctx: { logger: silent, toolRoot: getToolRoot() },
  });
  assert.strictEqual(out.agentId, 'crypto-x');
  assert.match(out.summary, /Sin noticias/i);
  assert.strictEqual(out.sentiment.label, 'neutral');
});

test('aiox-squad: persona faltante -> AgentError (degradacion elegante)', async () => {
  await assert.rejects(
    connector.runAgent({
      manifest: manifest('no-existe'),
      input: input([{ id: 'i1', title: 'T', url: 'https://x.co/a' }]),
      ctx: { logger: silent, toolRoot: getToolRoot() },
    }),
    AgentError,
  );
});

test('aiox-squad: id de experto invalido -> AgentError', async () => {
  await assert.rejects(
    connector.runAgent({
      manifest: manifest('Bad_Id'),
      input: input([{ id: 'i1', title: 'T', url: 'https://x.co/a' }]),
      ctx: { logger: silent, toolRoot: getToolRoot() },
    }),
    AgentError,
  );
});
