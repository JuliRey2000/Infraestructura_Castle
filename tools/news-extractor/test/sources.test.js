'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const sources = require('../src/sources');
const { normalizeItem } = require('../src/core/normalizer');
const cfg = require('../src/core/config-loader');

const ctx = (type) => ({ source: type, sourceType: type, language: 'es' });

test('registro expone los 6 adaptadores con contrato valido', () => {
  const types = sources.listTypes();
  for (const t of ['rss', 'coingecko', 'marketaux', 'alphavantage', 'finnhub', 'cmc']) {
    assert.ok(types.includes(t), `falta ${t}`);
    const a = sources.getSource(t);
    assert.strictEqual(typeof a.fetch, 'function');
    assert.strictEqual(typeof a.mapRaw, 'function');
  }
});

test('rss.mapRaw decodifica entidades y produce NewsItem', () => {
  const partial = sources.getSource('rss').mapRaw({
    title: 'BTC',
    link: 'https://x.co/a?utm_source=t&amp;id=5',
    description: 'd',
    publishedAt: '2026-06-24T09:00:00Z',
    source: 'coindesk.com',
  });
  const item = normalizeItem(partial, ctx('rss'));
  assert.strictEqual(item.url, 'https://x.co/a?id=5');
});

test('coingecko.mapRaw mapea updated_at (epoch s)', () => {
  const partial = sources.getSource('coingecko').mapRaw({
    title: 'Cripto news',
    url: 'https://x.co/cg',
    description: 'd',
    updated_at: '1750000000',
    news_site: 'CoinTelegraph',
  });
  const item = normalizeItem(partial, ctx('coingecko'));
  assert.ok(item.publishedAt.startsWith('2025-'));
  assert.deepStrictEqual(item.topics, ['crypto']);
});

test('marketaux.mapRaw extrae tickers y sentimiento de entities', () => {
  const partial = sources.getSource('marketaux').mapRaw({
    title: 'MSTR news',
    url: 'https://x.co/mx',
    description: 'd',
    published_at: '2026-06-24T09:00:00.000000Z',
    entities: [{ symbol: 'MSTR', type: 'equity', sentiment_score: 0.6 }],
  });
  const item = normalizeItem(partial, ctx('marketaux'));
  assert.deepStrictEqual(item.tickers, ['MSTR']);
  assert.strictEqual(item.sentiment.label, 'bullish');
});

test('alphavantage.mapRaw parsea time_published y mapea label', () => {
  const partial = sources.getSource('alphavantage').mapRaw({
    title: 'Nasdaq news',
    url: 'https://x.co/av',
    summary: 's',
    time_published: '20260624T130500',
    overall_sentiment_score: 0.25,
    overall_sentiment_label: 'Somewhat-Bullish',
    ticker_sentiment: [{ ticker: 'QQQ' }],
    topics: [{ topic: 'financial_markets' }],
  });
  const item = normalizeItem(partial, ctx('alphavantage'));
  assert.ok(item.publishedAt.startsWith('2026-06-24T13:05'));
  assert.strictEqual(item.sentiment.label, 'bullish');
  assert.deepStrictEqual(item.tickers, ['QQQ']);
});

test('finnhub.mapRaw mapea headline/datetime/related', () => {
  const partial = sources.getSource('finnhub').mapRaw({
    headline: 'AAPL news',
    url: 'https://x.co/fh',
    summary: 's',
    datetime: 1750000000,
    related: 'AAPL,MSFT',
    category: 'company',
  });
  const item = normalizeItem(partial, ctx('finnhub'));
  assert.deepStrictEqual(item.tickers, ['AAPL', 'MSFT']);
  assert.ok(item.publishedAt.startsWith('2025-'));
});

test('config-loader valida los 3 briefs', () => {
  const briefs = cfg.loadAllBriefs();
  const ids = briefs.map((b) => b.id).sort();
  assert.deepStrictEqual(ids, ['crypto', 'nasdaq100', 'saylor-strategy']);
  const saylor = cfg.loadBriefById('saylor-strategy');
  assert.deepStrictEqual(saylor.query.tickers, ['MSTR']);
  assert.strictEqual(saylor.dedup.strategy, 'both');
});
