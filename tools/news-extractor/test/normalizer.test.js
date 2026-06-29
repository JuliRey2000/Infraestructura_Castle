'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const {
  normalizeItem,
  stripRaw,
  sanitizeText,
  canonicalizeUrl,
  toIsoUtc,
  computeId,
  normalizeSentiment,
} = require('../src/core/normalizer');

test('sanitizeText quita HTML, decodifica entidades y recorta', () => {
  assert.strictEqual(sanitizeText('<b>Hola</b> &amp; chao'), 'Hola & chao');
  assert.strictEqual(sanitizeText('a'.repeat(10), 5).length, 5);
  assert.strictEqual(sanitizeText(null), '');
});

test('canonicalizeUrl quita tracking y exige https', () => {
  assert.strictEqual(
    canonicalizeUrl('https://x.co/a?utm_source=t&id=5&fbclid=z#frag'),
    'https://x.co/a?id=5',
  );
  assert.strictEqual(canonicalizeUrl('http://x.co/a'), null, 'http no-loopback se rechaza');
  assert.strictEqual(canonicalizeUrl('no-es-url'), null);
});

test('toIsoUtc parsea epoch (s/ms), ISO y RFC822', () => {
  assert.ok(toIsoUtc(1700000000).startsWith('2023-'), 'epoch en segundos');
  assert.ok(toIsoUtc(1700000000000).startsWith('2023-'), 'epoch en ms');
  assert.ok(toIsoUtc('Tue, 24 Jun 2026 09:00:00 GMT').startsWith('2026-06-24'), 'RFC822');
  assert.strictEqual(toIsoUtc('basura'), null);
  assert.strictEqual(toIsoUtc(null), null);
});

test('computeId es estable y de 32 chars', () => {
  const a = computeId('https://x.co/a', 'T', 'S');
  const b = computeId('https://x.co/a', 'OTRO', 'OTRO');
  assert.strictEqual(a.length, 32);
  assert.strictEqual(a, b, 'mismo canonicalUrl => mismo id');
});

test('normalizeSentiment clampa y deriva label', () => {
  assert.deepStrictEqual(normalizeSentiment({ score: 2 }), { score: 1, label: 'bullish' });
  assert.deepStrictEqual(normalizeSentiment({ score: -0.5 }), { score: -0.5, label: 'bearish' });
  assert.strictEqual(normalizeSentiment(null), null);
});

test('normalizeItem descarta items invalidos y produce NewsItem', () => {
  const ctx = { source: 'CoinDesk', sourceType: 'rss', language: 'es' };
  assert.strictEqual(normalizeItem({ title: '', url: 'https://x.co/a' }, ctx), null, 'sin title');
  assert.strictEqual(normalizeItem({ title: 'T', url: 'http://x.co/a' }, ctx), null, 'url no-https');
  const item = normalizeItem(
    { title: 'BTC sube', url: 'https://x.co/a?utm_source=t', summary: '<i>resumen</i>', tickers: ['btc'], publishedAt: '2026-06-24T09:00:00Z' },
    ctx,
  );
  assert.strictEqual(item.title, 'BTC sube');
  assert.strictEqual(item.url, 'https://x.co/a');
  assert.strictEqual(item.summary, 'resumen');
  assert.deepStrictEqual(item.tickers, ['BTC']);
  assert.strictEqual(item.sourceType, 'rss');
});

test('stripRaw remueve el campo raw', () => {
  const withRaw = { id: 'a', title: 'T', raw: { secreto: 1 } };
  const clean = stripRaw(withRaw);
  assert.strictEqual(clean.raw, undefined);
  assert.strictEqual(clean.title, 'T');
});
