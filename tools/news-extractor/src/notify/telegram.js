'use strict';

const baseLogger = require('../core/logger');

/**
 * Notificador Telegram. POST https a api.telegram.org con `fetch` (via HttpClient).
 * Token y chat id SOLO desde env. Si falta config, se omite sin romper el run.
 */

const API_BASE = 'https://api.telegram.org';
const MAX_LEN = 3900; // limite Telegram 4096, dejamos margen

function isConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Quita markdown/markup para un texto plano legible en Telegram. */
function stripMarkdown(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Construye el mensaje de resumen de un brief.
 * @returns {string} texto plano (sin parse_mode)
 */
function formatMessage({ brief, items, agentOutputs, date, briefRelPath }) {
  const lines = [];
  lines.push(`📊 ${brief.displayName || brief.id} — ${date}`);

  const primary = (agentOutputs || []).find((o) => !o.unavailable && o.summary);
  if (primary) {
    const synth = stripMarkdown(primary.summary).slice(0, 320);
    lines.push('');
    lines.push(synth + (primary.summary.length > 320 ? '…' : ''));
    if (primary.sentiment) {
      lines.push('');
      lines.push(`Sentimiento: ${primary.sentiment.label} (${primary.sentiment.score})`);
    }
  }

  const top = [...(items || [])]
    .sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0))
    .slice(0, 4);
  if (top.length) {
    lines.push('');
    lines.push('Top:');
    for (const it of top) lines.push(`• ${it.title} (${it.source})`);
  }

  lines.push('');
  lines.push(`${(items || []).length} noticias` + (briefRelPath ? ` · ${briefRelPath}` : ''));

  let text = lines.join('\n');
  if (text.length > MAX_LEN) text = `${text.slice(0, MAX_LEN - 1)}…`;
  return text;
}

/**
 * Envia un mensaje a Telegram.
 * @param {object} args
 * @param {import('../core/http-client').HttpClient} args.http
 * @param {string} args.text
 * @param {object} [args.logger]
 * @returns {Promise<{sent:boolean, skipped?:string}>}
 */
async function send({ http, text, logger = baseLogger }) {
  if (!isConfigured()) {
    logger.warn('Telegram no configurado (TELEGRAM_BOT_TOKEN/CHAT_ID ausentes), se omite');
    return { sent: false, skipped: 'not_configured' };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `${API_BASE}/bot${token}/sendMessage`;
  const body = {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: true,
  };
  const res = await http.postJson(url, body, { retries: 1, timeoutMs: 12000 });
  if (res && res.ok) return { sent: true };
  logger.warn('Telegram respondio sin ok', {
    description: res && res.description ? String(res.description).slice(0, 120) : 'desconocido',
  });
  return { sent: false, skipped: 'api_error' };
}

module.exports = { isConfigured, formatMessage, stripMarkdown, send };
