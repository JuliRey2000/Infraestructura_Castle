'use strict';

const { clampLimit, withinSince, take } = require('./base-source');

/**
 * Adaptador Marketaux. Tickers + sentimiento + extraccion de entidades.
 * Ideal para MSTR y bolsa. 5000+ fuentes. Key via env (api_token en query).
 */

const BASE = 'https://api.marketaux.com/v1/news/all';

function avgSentiment(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return null;
  const scores = entities
    .map((e) => Number(e.sentiment_score))
    .filter((n) => Number.isFinite(n));
  if (scores.length === 0) return null;
  const score = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { score };
}

module.exports = {
  type: 'marketaux',
  requiresKey: true,
  envKey: 'MARKETAUX_API_KEY',

  async fetch(query, ctx) {
    const token = process.env.MARKETAUX_API_KEY;
    const params = new URLSearchParams();
    params.set('api_token', token || '');
    params.set('filter_entities', 'true');
    params.set('language', 'en');
    params.set('limit', String(clampLimit(query.limit, 10, 100)));
    if (Array.isArray(query.tickers) && query.tickers.length) {
      params.set('symbols', query.tickers.join(','));
    }
    if (Array.isArray(query.keywords) && query.keywords.length) {
      params.set('search', query.keywords.join(' | '));
    }
    if (query.sinceIso) params.set('published_after', query.sinceIso.slice(0, 16));

    const data = await ctx.http.getJson(`${BASE}?${params.toString()}`, { signal: ctx.signal });
    const list = Array.isArray(data && data.data) ? data.data : [];
    const limit = clampLimit(query.limit, 10, 100);
    const out = [];
    for (const it of list) {
      const tsMs = it.published_at ? Date.parse(it.published_at) : NaN;
      if (withinSince(tsMs, query.sinceTs)) out.push(it);
    }
    return take(out, limit);
  },

  mapRaw(raw) {
    const entities = Array.isArray(raw.entities) ? raw.entities : [];
    const tickers = entities
      .filter((e) => e && (e.type === 'equity' || e.symbol))
      .map((e) => e.symbol)
      .filter(Boolean);
    return {
      title: raw.title,
      url: raw.url,
      summary: raw.description || raw.snippet,
      publishedAt: raw.published_at,
      language: raw.language || 'en',
      tickers,
      topics: [],
      sentiment: avgSentiment(entities),
      raw: { source: raw.source || null },
    };
  },
};
