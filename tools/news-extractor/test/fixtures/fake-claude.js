#!/usr/bin/env node
'use strict';

/**
 * Fixture que simula el binario `claude` en modo `-p --output-format json`.
 * Ignora los flags, lee el user prompt por stdin y emite un envelope como el de
 * Claude Code, con un AgentOutput (en fence) dentro de `result`. Sin red, sin API.
 * Permite testear el transport aiox-squad 100% offline.
 */

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  void Buffer.concat(chunks).toString('utf8'); // user prompt (no se usa, solo se drena)
  const output = {
    schemaVersion: '1.0',
    summary: 'fake-claude ok',
    sentiment: { score: 0.2, label: 'bullish' },
    signals: [{ label: 'demo', direction: 'bullish', confidence: 0.5 }],
    highlights: [],
    warnings: [],
  };
  const envelope = {
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '```json\n' + JSON.stringify(output) + '\n```',
  };
  process.stdout.write(JSON.stringify(envelope));
});
