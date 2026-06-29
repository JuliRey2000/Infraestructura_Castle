'use strict';

const { clampLimit, withinSince, take } = require('./base-source');

/**
 * Adaptador Alpha Vantage NEWS_SENTIMENT. Licencia NASDAQ, ticker + topic +
 * sentimiento. Key via env (apikey en query). Devuelve hasta 1000 articulos.
 */

const BASE = 'https://www.alphavantage.co/query';

/** Mapea la etiqueta de AV (Bullish/Somewhat-Bullish/...) a bullish|neutral|bearish. */
function mapAvLabel(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('bull')) return 'bullish';
  if (l.includes('bear')) return 'bearish';
  return 'neutral';
}

/** "20260623T130500" -> ISO-UTC. */
function avTimeToIso(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** time_from para AV: "YYYYMMDDTHHMM". */
function isoToAvTimeFrom(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
  );
}

module.exports = {
  type: 'alphavantage',
  requiresKey: true,
  envKey: 'ALPHAVANTAGE_API_KEY',

  async fetch(query, ctx) {
    const apikey = process.env.ALPHAVANTAGE_API_KEY;
    const params = new URLSearchParams();
    params.set('function', 'NEWS_SENTIMENT');
    params.set('sort', 'LATEST');
    params.set('limit', String(clampLimit(query.limit, 50, 1000)));
    params.set('apikey', apikey || '');
    if (Array.isArray(query.tickers) && query.tickers.length) {
      params.set('tickers', query.tickers.join(','));
    }
    if (Array.isArray(query.topics) && query.topics.length) {
      params.set('topics', query.topics.join(','));
    }
    const timeFrom = query.sinceIso ? isoToAvTimeFrom(query.sinceIso) : null;
    if (timeFrom) params.set('time_from', timeFrom);

    const data = await ctx.http.getJson(`${BASE}?${params.toString()}`, { signal: ctx.signal });
    if (data && (data.Note || data.Information) && !Array.isArray(data.feed)) {
      ctx.logger.warn('AlphaVantage limite/aviso', {
        note: String(data.Note || data.Information).slice(0, 120),
      });
      return [];
    }
    const list = Array.isArray(data && data.feed) ? data.feed : [];
    const limit = clampLimit(query.limit, 50, 1000);
    const out = [];
    for (const it of list) {
      const iso = avTimeToIso(it.time_published);
      const tsMs = iso ? Date.parse(iso) : NaN;
      if (withinSince(tsMs, query.sinceTs)) out.push(it);
    }
    return take(out, limit);
  },

  mapRaw(raw) {
    const tickers = Array.isArray(raw.ticker_sentiment)
      ? raw.ticker_sentiment.map((t) => t.ticker).filter(Boolean)
      : [];
    const topics = Array.isArray(raw.topics)
      ? raw.topics.map((t) => (t && t.topic) || t).filter((x) => typeof x === 'string')
      : [];
    const score = Number(raw.overall_sentiment_score);
    return {
      title: raw.title,
      url: raw.url,
      summary: raw.summary,
      publishedAt: avTimeToIso(raw.time_published),
      language: 'en',
      tickers,
      topics,
      sentiment: Number.isFinite(score)
        ? { score, label: mapAvLabel(raw.overall_sentiment_label) }
        : null,
      raw: { source: raw.source || null },
    };
  },
};
