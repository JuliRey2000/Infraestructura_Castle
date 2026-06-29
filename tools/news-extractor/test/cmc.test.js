'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cmc = require('../src/sources/cmc');
const { extractReadings, isSupportedCategory } = require('../src/sources/cmc-extract');
const { normalizeItem } = require('../src/core/normalizer');

// Logger noop para los tests (la fuente degrada con warn, nunca lanza).
const noopLogger = { warn() {}, info() {}, debug() {} };
const ctx = { source: 'cmc', sourceType: 'cmc', language: 'es', logger: noopLogger };

function sampleBundle(date = '2026-06-28') {
  return {
    schema: 'cmc-snapshot/v1',
    generatedAt: new Date().toISOString(),
    date,
    packs: [
      {
        skill: 'detect_market_regime',
        category: 'regime',
        coin: 'MARKET',
        asOf: `${date}T10:30:00Z`,
        blocked: false,
        bias: 'bullish',
        headline: 'Régimen: trend_expansion (conviction media)',
        value: '30d: expansión de tendencia, participación sana',
        interpretation: 'Mercado en expansión de tendencia con apalancamiento no extremo; sesgo constructivo.',
      },
      {
        skill: 'perp_contract_analysis',
        category: 'derivatives',
        coin: 'BTC',
        asOf: `${date}T10:31:00Z`,
        blocked: false,
        bias: 'bearish',
        headline: 'Perps: long-crowded, funding alto (squeeze risk)',
        value: 'funding +0.04%, OI/MC elevado',
        interpretation: 'Posicionamiento largo saturado; riesgo de squeeze si el spot no confirma.',
      },
      {
        skill: 'analyze_btc_eth_etf_flow_impact',
        category: 'etf',
        coin: 'XRP',
        blocked: true, // XRP suele venir bloqueado en varias lanes
        headline: 'ETF flows XRP',
        interpretation: 'no disponible',
      },
      {
        skill: 'unknown_skill',
        category: 'no-existe',
        coin: 'BTC',
        headline: 'algo',
        interpretation: 'algo',
      },
      {
        skill: 'daily_market_overview',
        category: 'overview',
        coin: 'MARKET',
        headline: '', // sin titular -> descartado
        interpretation: 'x',
      },
    ],
  };
}

test('cmc-extract: aplana packs validos y descarta blocked/desconocidos/sin-titular', () => {
  const readings = extractReadings(sampleBundle(), { logger: noopLogger });
  assert.strictEqual(readings.length, 2, 'solo regime + derivatives son validos');
  const cats = readings.map((r) => r.category).sort();
  assert.deepStrictEqual(cats, ['derivatives', 'regime']);
  const regime = readings.find((r) => r.category === 'regime');
  assert.strictEqual(regime.coin, 'MARKET');
  assert.strictEqual(regime.day, '2026-06-28');
  assert.strictEqual(regime.bias, 'bullish');
});

test('cmc-extract: isSupportedCategory whitelist', () => {
  assert.ok(isSupportedCategory('regime'));
  assert.ok(isSupportedCategory('derivatives'));
  assert.ok(!isSupportedCategory('no-existe'));
  assert.ok(!isSupportedCategory(undefined));
});

test('cmc-extract: bundle sin fecha valida ni packs => []', () => {
  assert.deepStrictEqual(extractReadings({ packs: [] }, { logger: noopLogger }), []);
  assert.deepStrictEqual(extractReadings(null, { logger: noopLogger }), []);
  // fallbackDate rescata cuando falta date/generatedAt
  const r = extractReadings(
    { packs: [{ category: 'regime', coin: 'MARKET', headline: 'h', interpretation: 'i' }] },
    { logger: noopLogger, fallbackDate: '2026-06-28' },
  );
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].day, '2026-06-28');
});

test('cmc.mapRaw: URL HTTPS sintetica sobrevive al normalizador (no descarta por URL)', () => {
  const [regime, derivatives] = extractReadings(sampleBundle(), { logger: noopLogger });
  const itemR = normalizeItem(cmc.mapRaw(regime), ctx);
  const itemD = normalizeItem(cmc.mapRaw(derivatives), ctx);

  assert.ok(itemR, 'la lectura MARKET no debe descartarse');
  assert.ok(itemD, 'la lectura BTC no debe descartarse');
  assert.strictEqual(itemR.url, 'https://coinmarketcap.com/cmc-hub/market/regime/2026-06-28');
  assert.strictEqual(itemD.url, 'https://coinmarketcap.com/cmc-hub/btc/derivatives/2026-06-28');

  // MARKET no aporta ticker; BTC si.
  assert.deepStrictEqual(itemR.tickers, []);
  assert.deepStrictEqual(itemD.tickers, ['BTC']);

  // topics tag de fuente + lane.
  assert.deepStrictEqual(itemD.topics, ['cmc', 'derivatives']);

  // sentiment derivado del bias.
  assert.strictEqual(itemR.sentiment.label, 'bullish');
  assert.strictEqual(itemD.sentiment.label, 'bearish');

  // titulo legible con prefijo de coin + sufijo de fecha.
  assert.ok(itemD.title.startsWith('BTC · Perps'));
  assert.ok(itemD.title.includes('28 jun'));
});

test('cmc.mapRaw: id idempotente el mismo dia, distinto entre dias', () => {
  const today = extractReadings(sampleBundle('2026-06-28'), { logger: noopLogger })[1];
  const tomorrow = extractReadings(sampleBundle('2026-06-29'), { logger: noopLogger })[1];

  const a = normalizeItem(cmc.mapRaw(today), ctx);
  const b = normalizeItem(cmc.mapRaw(today), ctx); // re-run mismo dia
  const c = normalizeItem(cmc.mapRaw(tomorrow), ctx);

  assert.strictEqual(a.id, b.id, 're-run del mismo dia => mismo id (idempotente)');
  assert.notStrictEqual(a.id, c.id, 'dia distinto => id distinto (aparece de nuevo)');
  // El sufijo de fecha hace que el titulo tambien difiera entre dias.
  assert.notStrictEqual(a.title, c.title);
});

test('cmc.fetch: snapshot fresco => lecturas; ausente => []; stale => []', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmc-test-'));
  try {
    const query = { sinceTs: Date.parse('2026-06-27T00:00:00Z') };

    // Ausente: directorio vacio
    let out = await cmc.fetch(query, { logger: noopLogger, options: { snapshotDir: dir } });
    assert.deepStrictEqual(out, []);

    // Fresco
    const fresh = sampleBundle('2026-06-28');
    fresh.generatedAt = new Date().toISOString();
    fs.writeFileSync(path.join(dir, '2026-06-28.json'), JSON.stringify(fresh));
    out = await cmc.fetch(query, { logger: noopLogger, options: { snapshotDir: dir } });
    assert.strictEqual(out.length, 2, 'devuelve las 2 lecturas validas');

    // Stale: generatedAt viejo (> maxAgeHours)
    const stale = sampleBundle('2026-06-29');
    stale.generatedAt = new Date(Date.now() - 48 * 3.6e6).toISOString();
    fs.writeFileSync(path.join(dir, '2026-06-29.json'), JSON.stringify(stale));
    out = await cmc.fetch(query, { logger: noopLogger, options: { snapshotDir: dir, maxAgeHours: 26 } });
    assert.deepStrictEqual(out, [], 'snapshot mas reciente esta stale => []');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cmc.fetch: filtra lecturas anteriores a sinceTs', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmc-test-'));
  try {
    const bundle = sampleBundle('2026-06-28');
    bundle.generatedAt = new Date().toISOString();
    // Una lectura con asOf muy viejo
    bundle.packs[0].asOf = '2020-01-01T00:00:00Z';
    fs.writeFileSync(path.join(dir, '2026-06-28.json'), JSON.stringify(bundle));

    const query = { sinceTs: Date.parse('2026-06-27T00:00:00Z') };
    const out = await cmc.fetch(query, { logger: noopLogger, options: { snapshotDir: dir } });
    assert.strictEqual(out.length, 1, 'la lectura vieja queda fuera de la ventana');
    assert.strictEqual(out[0].category, 'derivatives');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cmc adaptador: requiresKey=false y contrato valido', () => {
  assert.strictEqual(cmc.type, 'cmc');
  assert.strictEqual(cmc.requiresKey, false);
  assert.strictEqual(typeof cmc.fetch, 'function');
  assert.strictEqual(typeof cmc.mapRaw, 'function');
});
