'use strict';

const { clampLimit, withinSince, take } = require('./base-source');

/**
 * Adaptador CoinGecko (news endpoint). Cripto, agrega 100+ fuentes.
 * Free/Demo tier: header `x-cg-demo-api-key`. ~10k llamadas/mes.
 */

const BASE = 'https://api.coingecko.com/api/v3';

function rawTsMs(raw) {
  if (raw.updated_at != null && /^\d+$/.test(String(raw.updated_at))) {
    return Number(raw.updated_at) * 1000;
  }
  if (raw.published_at) {
    const t = Date.parse(raw.published_at);
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

module.exports = {
  type: 'coingecko',
  requiresKey: true,
  envKey: 'COINGECKO_API_KEY',

  async fetch(query, ctx) {
    const key = process.env.COINGECKO_API_KEY;
    const data = await ctx.http.getJson(`${BASE}/news`, {
      signal: ctx.signal,
      headers: key ? { 'x-cg-demo-api-key': key } : {},
    });
    const list = Array.isArray(data && data.data) ? data.data : [];
    const limit = clampLimit(query.limit, 30, 100);
    const out = [];
    for (const it of list) {
      if (withinSince(rawTsMs(it), query.sinceTs)) out.push(it);
    }
    return take(out, limit);
  },

  mapRaw(raw) {
    const ts = rawTsMs(raw);
    return {
      title: raw.title,
      url: raw.url,
      summary: raw.description,
      publishedAt: Number.isFinite(ts) ? ts : raw.published_at || null,
      language: 'en',
      tickers: [],
      topics: ['crypto'],
      sentiment: null,
      raw: { news_site: raw.news_site || raw.author || null },
    };
  },
};
