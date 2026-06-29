#!/usr/bin/env node
'use strict';

/**
 * Agente-fixture trivial para tests offline del transport CLI. Lee un AgentInput
 * por stdin y emite un AgentOutput valido por stdout. Sin red, sin API.
 * Demuestra que un segundo agente se conecta sin tocar el core.
 */

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    process.stderr.write('input invalido\n');
    process.exit(1);
  }
  const items = Array.isArray(input.items) ? input.items : [];
  const first = items[0];
  const output = {
    schemaVersion: '1.0',
    agentId: 'echo-test',
    summary: `Echo: ${items.length} items para ${input.brief && input.brief.id}.`,
    sentiment: { score: 0, label: 'neutral' },
    signals: [],
    highlights: first ? [{ itemId: first.id, why: 'primer item', importance: 3 }] : [],
    warnings: [],
  };
  process.stdout.write(JSON.stringify(output));
});
