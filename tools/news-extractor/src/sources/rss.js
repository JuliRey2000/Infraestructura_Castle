'use strict';

const { clampLimit, withinSince, take } = require('./base-source');

/**
 * Adaptador RSS/Atom. No requiere API key. Sirve de base y fallback para cripto.
 * Feeds configurables via `source.options.feeds` en el brief; si no, usa defaults.
 *
 * Parser defensivo: limite de tamano, sin DTD/entidades externas (regex no
 * expande entidades), CDATA-aware. Un feed que falla no rompe el run.
 */

const DEFAULT_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed',
];

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB por feed

function stripCdata(text) {
  if (text == null) return '';
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  return (m ? m[1] : text).trim();
}

/** Decodifica entidades XML en una URL (RSS suele envolver & como &amp;). */
function decodeUrlEntities(url) {
  return String(url || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');
}

function firstTag(block, tags) {
  for (const tag of tags) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = re.exec(block);
    if (m) return stripCdata(m[1]);
  }
  return '';
}

/** Extrae el href de un <link> RSS (texto) o Atom (atributo href). */
function extractLink(block) {
  const rss = /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(block);
  if (rss && rss[1] && rss[1].trim()) return stripCdata(rss[1]);
  // Atom: preferir rel="alternate", sino el primer href.
  const links = [...block.matchAll(/<link\b([^>]*)\/?>(?:<\/link>)?/gi)];
  let fallback = '';
  for (const m of links) {
    const attrs = m[1];
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!href) continue;
    if (/rel\s*=\s*["']alternate["']/i.test(attrs)) return href[1];
    if (!fallback) fallback = href[1];
  }
  return fallback;
}

function parseBlocks(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
    if (out.length >= 200) break; // techo de seguridad
  }
  return out;
}

function parseFeed(xml, feedUrl) {
  const text = xml.length > MAX_BYTES ? xml.slice(0, MAX_BYTES) : xml;
  let blocks = parseBlocks(text, 'item'); // RSS
  if (blocks.length === 0) blocks = parseBlocks(text, 'entry'); // Atom
  const host = (() => {
    try {
      return new URL(feedUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'rss';
    }
  })();

  return blocks.map((b) => {
    const dateRaw = firstTag(b, ['pubDate', 'published', 'updated', 'dc:date']);
    const parsed = dateRaw ? Date.parse(dateRaw) : NaN;
    return {
      title: firstTag(b, ['title']),
      link: decodeUrlEntities(extractLink(b)),
      description: firstTag(b, ['description', 'summary', 'content:encoded', 'content']),
      publishedAt: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
      _tsMs: parsed,
      source: host,
    };
  });
}

module.exports = {
  type: 'rss',
  requiresKey: false,
  envKey: null,

  async fetch(query, ctx) {
    const logger = ctx.logger;
    const feeds =
      ctx.options && Array.isArray(ctx.options.feeds) && ctx.options.feeds.length
        ? ctx.options.feeds
        : DEFAULT_FEEDS;
    const limit = clampLimit(query.limit, 30, 80);
    const collected = [];

    for (const feed of feeds) {
      if (!/^https:\/\//i.test(String(feed))) {
        logger.warn('RSS feed no-https omitido', { feed: String(feed).slice(0, 80) });
        continue;
      }
      try {
        const xml = await ctx.http.getText(feed, { signal: ctx.signal, timeoutMs: 12000 });
        const parsed = parseFeed(xml, feed);
        for (const it of parsed) {
          if (it.title && it.link && withinSince(it._tsMs, query.sinceTs)) collected.push(it);
        }
      } catch (err) {
        logger.warn('RSS feed fallo (continuando)', { feed, error: err.message });
      }
    }
    return take(collected, limit);
  },

  mapRaw(raw) {
    return {
      title: raw.title,
      url: decodeUrlEntities(raw.link),
      summary: raw.description,
      publishedAt: raw.publishedAt,
      language: 'en',
      tickers: [],
      topics: [],
      sentiment: null,
      raw: { feed: raw.source },
    };
  },
};
