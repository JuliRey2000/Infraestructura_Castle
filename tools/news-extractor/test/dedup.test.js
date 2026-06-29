'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { dedupe, titleHash, pruneIndex } = require('../src/core/dedup');

function item(id, url, title) {
  return { id, canonicalUrl: url, url, title };
}

test('titleHash normaliza y es estable', () => {
  assert.strictEqual(titleHash('Bitcoin SUBE 10%!'), titleHash('bitcoin  sube 10 %'));
  assert.strictEqual(titleHash(''), null);
});

test('dedupe intra-run elimina por canonical-url', () => {
  const r = dedupe(
    [item('1', 'https://x.co/a', 'BTC sube'), item('2', 'https://x.co/a', 'Otro titulo')],
    { strategy: 'both', window: '48h', index: {} },
  );
  assert.strictEqual(r.stats.kept, 1);
  assert.strictEqual(r.stats.removed, 1);
  assert.strictEqual(r.stats.intra, 1);
});

test('dedupe intra-run elimina por title-hash aunque cambie la url', () => {
  const r = dedupe(
    [item('1', 'https://a.co/x', 'Bitcoin sube 10%'), item('2', 'https://b.co/y', 'BITCOIN SUBE 10 %')],
    { strategy: 'both', window: '48h', index: {} },
  );
  assert.strictEqual(r.stats.kept, 1);
});

test('dedupe inter-run usa el indice persistente', () => {
  const first = dedupe([item('1', 'https://x.co/a', 'T1')], { strategy: 'url', window: '48h', index: {} });
  const second = dedupe([item('2', 'https://x.co/a', 'T1 distinto')], {
    strategy: 'url',
    window: '48h',
    index: first.index,
  });
  assert.strictEqual(second.stats.kept, 0, 'ya visto en run previo');
  assert.strictEqual(second.stats.inter, 1);
});

test('strategy url no deduplica por titulo', () => {
  const r = dedupe(
    [item('1', 'https://a.co/x', 'Mismo Titulo'), item('2', 'https://b.co/y', 'Mismo Titulo')],
    { strategy: 'url', window: '48h', index: {} },
  );
  assert.strictEqual(r.stats.kept, 2);
});

test('pruneIndex descarta entradas fuera de ventana', () => {
  const now = Date.now();
  const idx = {
    reciente: new Date(now - 1000).toISOString(),
    viejo: new Date(now - 1000 * 60 * 60 * 100).toISOString(),
  };
  const pruned = pruneIndex(idx, 48 * 60 * 60 * 1000, now);
  assert.ok(pruned.reciente);
  assert.strictEqual(pruned.viejo, undefined);
});
