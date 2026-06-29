'use strict';

const { clampLimit, withinSince, take } = require('./base-source');

/**
 * Adaptador Finnhub. Company news (por ticker) o market news general (fallback).
 * 60 llamadas/min en free tier. Key via env (token en query).
 */

const BASE = 'https://finnhub.io/api/v1';

function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

module.exports = {
  type: 'finnhub',
  requiresKey: true,
  envKey: 'FINNHUB_API_KEY',

  async fetch(query, ctx) {
    const token = process.env.FINNHUB_API_KEY || '';
    const limit = clampLimit(query.limit, 30, 100);
    const collected = [];

    if (Array.isArray(query.tickers) && query.tickers.length) {
      const from = query.sinceIso ? ymd(new Date(query.sinceIso)) : ymd(new Date(Date.now() - 7 * 864e5));
      const to = ymd(new Date());
      for (const symbol of query.tickers.slice(0, 8)) {
        const params = new URLSearchParams({ symbol, from, to, token });
        try {
          const list = await ctx.http.getJson(`${BASE}/company-news?${params.toString()}`, {
            signal: ctx.signal,
          });
          if (Array.isArray(list)) collected.push(...list);
        } catch (err) {
          ctx.logger.warn('Finnhub company-news fallo (continuando)', {
            symbol,
            error: err.message,
          });
        }
      }
    } else {
      const params = new URLSearchParams({ category: 'general', token });
      const list = await ctx.http.getJson(`${BASE}/news?${params.toString()}`, {
        signal: ctx.signal,
      });
      if (Array.isArray(list)) collected.push(...list);
    }

    const out = [];
    for (const it of collected) {
      const tsMs = Number(it.datetime) ? Number(it.datetime) * 1000 : NaN;
      if (withinSince(tsMs, query.sinceTs)) out.push(it);
    }
    // Orden por fecha desc para que take() conserve lo mas reciente.
    out.sort((a, b) => Number(b.datetime || 0) - Number(a.datetime || 0));
    return take(out, limit);
  },

  mapRaw(raw) {
    const tickers =
      typeof raw.related === 'string' && raw.related
        ? raw.related.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    return {
      title: raw.headline,
      url: raw.url,
      summary: raw.summary,
      publishedAt: Number(raw.datetime) ? Number(raw.datetime) * 1000 : null,
      language: 'en',
      tickers,
      topics: raw.category ? [String(raw.category)] : [],
      sentiment: null,
      raw: { source: raw.source || null, id: raw.id || null },
    };
  },
};
