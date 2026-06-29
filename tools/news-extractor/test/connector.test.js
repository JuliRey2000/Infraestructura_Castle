'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const connector = require('../src/agents/connector');
const { getToolRoot } = require('../src/core/config-loader');
const { AgentError } = require('../src/core/errors');

const silent = { debug() {}, info() {}, warn() {}, error() {}, child() { return silent; } };

test('validateAgentOutput normaliza y clampa', () => {
  const out = connector.validateAgentOutput(
    {
      summary: 'analisis',
      sentiment: { score: 5, label: 'x' },
      signals: [{ label: 'S', direction: 'arriba', confidence: 2 }],
      highlights: [{ itemId: 'a', importance: 99 }],
      warnings: ['w', 123],
    },
    'ai-synthesizer',
  );
  assert.strictEqual(out.agentId, 'ai-synthesizer');
  assert.deepStrictEqual(out.sentiment, { score: 1, label: 'bullish' });
  assert.strictEqual(out.signals[0].direction, 'neutral');
  assert.strictEqual(out.signals[0].confidence, 1);
  assert.strictEqual(out.highlights[0].importance, 5);
  assert.deepStrictEqual(out.warnings, ['w']);
});

test('validateAgentOutput rechaza salida sin summary', () => {
  assert.throws(() => connector.validateAgentOutput({ agentId: 'x' }, 'x'), AgentError);
  assert.throws(() => connector.validateAgentOutput(null, 'x'), AgentError);
});

test('buildAgentInput arma el contrato esperado', () => {
  const input = connector.buildAgentInput({
    brief: { id: 'crypto', displayName: 'Cripto', language: 'es', query: { keywords: ['btc'], tickers: [], topics: [] } },
    items: [{ id: 'a', title: 'T', url: 'https://x.co/a' }],
    runId: 'r#crypto',
    context: { timezone: 'America/Bogota' },
  });
  assert.strictEqual(input.schemaVersion, '1.0');
  assert.strictEqual(input.brief.id, 'crypto');
  assert.strictEqual(input.brief.display_name, 'Cripto');
  assert.strictEqual(input.items.length, 1);
  assert.strictEqual(input.runId, 'r#crypto');
});

test('runAgent: round-trip por transport CLI (agente-fixture echo)', async () => {
  const manifest = {
    agent: { id: 'echo-test', displayName: 'Echo' },
    transport: { type: 'cli', command: 'node', args: ['test/fixtures/echo-agent.js'], cwd: '.', timeout_ms: 15000 },
  };
  const input = connector.buildAgentInput({
    brief: { id: 'crypto', displayName: 'Cripto', language: 'es', query: { keywords: [], tickers: [], topics: [] } },
    items: [{ id: 'item-1', title: 'BTC', url: 'https://x.co/a' }],
    runId: 'r#crypto',
  });
  const out = await connector.runAgent({ manifest, input, ctx: { logger: silent, toolRoot: getToolRoot() } });
  assert.strictEqual(out.agentId, 'echo-test');
  assert.match(out.summary, /1 items/);
  assert.strictEqual(out.highlights[0].itemId, 'item-1');
});

test('runAgent: transport desconocido lanza AgentError', async () => {
  await assert.rejects(
    connector.runAgent({
      manifest: { agent: { id: 'x' }, transport: { type: 'inexistente' } },
      input: {},
      ctx: { logger: silent, toolRoot: getToolRoot() },
    }),
    AgentError,
  );
});
