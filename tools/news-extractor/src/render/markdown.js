'use strict';

/**
 * Render de un brief en Markdown a partir de NewsItem[] + AgentOutput[].
 * El campo `raw` jamas se renderiza (se asume ya removido; defensivo igual).
 */

const SENT_EMOJI = { bullish: '🟢', bearish: '🔴', neutral: '⚪' };
const DIR_EMOJI = { bullish: '📈', bearish: '📉', neutral: '➖' };

/** Escapa caracteres que romperian un enlace markdown en el texto del link. */
function linkText(s) {
  return String(s || '').replace(/[[\]]/g, '\\$&');
}

function fmtDateTime(iso, tz) {
  if (!iso) return 's/f';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 's/f';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: tz || 'America/Bogota',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function sentimentLine(sentiment) {
  if (!sentiment) return '';
  const emoji = SENT_EMOJI[sentiment.label] || '⚪';
  return `${emoji} ${sentiment.label} (${sentiment.score})`;
}

function renderAgentSection(out, itemsById, tz) {
  void tz;
  const lines = [];
  const name = out.displayName || out.agentId || 'Agente';
  lines.push(`## 🧠 ${name}`);
  lines.push('');

  if (out.unavailable) {
    lines.push(`> _Análisis no disponible: ${out.error || 'el agente falló en este run.'}_`);
    lines.push('');
    return lines.join('\n');
  }

  if (out.sentiment) {
    lines.push(`**Sentimiento general:** ${sentimentLine(out.sentiment)}`);
    lines.push('');
  }
  if (out.summary && out.summary.trim()) {
    lines.push(out.summary.trim());
    lines.push('');
  }

  if (Array.isArray(out.signals) && out.signals.length) {
    lines.push('### Señales');
    for (const s of out.signals) {
      const dir = DIR_EMOJI[s.direction] || '➖';
      const conf = Number.isFinite(s.confidence) ? ` · conf ${(s.confidence * 100).toFixed(0)}%` : '';
      lines.push(`- ${dir} **${s.label}**${conf}` + (s.rationale ? ` — ${s.rationale}` : ''));
    }
    lines.push('');
  }

  if (Array.isArray(out.highlights) && out.highlights.length) {
    lines.push('### Destacados');
    out.highlights.forEach((h, i) => {
      const it = itemsById.get(h.itemId);
      const imp = Number.isFinite(h.importance) ? ` (importancia ${h.importance}/5)` : '';
      if (it) {
        lines.push(`${i + 1}. [${linkText(it.title)}](${it.url}) — ${h.why || ''}${imp}`);
      } else if (h.why) {
        lines.push(`${i + 1}. ${h.why}${imp}`);
      }
    });
    lines.push('');
  }

  if (Array.isArray(out.warnings) && out.warnings.length) {
    lines.push('### ⚠️ Advertencias');
    for (const w of out.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  return lines.join('\n');
}

function renderNewsList(items, tz) {
  const lines = ['## 📰 Noticias', ''];
  if (items.length === 0) {
    lines.push('_Sin noticias nuevas en la ventana configurada._', '');
    return lines.join('\n');
  }
  // Orden por fecha desc (las sin fecha al final).
  const sorted = [...items].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });
  for (const it of sorted) {
    const meta = [it.source, fmtDateTime(it.publishedAt, tz)];
    const sent = sentimentLine(it.sentiment);
    if (sent) meta.push(sent);
    if (it.tickers && it.tickers.length) meta.push(it.tickers.join(', '));
    lines.push(`- [${linkText(it.title)}](${it.url})`);
    lines.push(`  _${meta.filter(Boolean).join(' · ')}_`);
    if (it.summary) lines.push(`  ${it.summary}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Renderiza el brief completo.
 * @param {object} args
 * @param {object} args.brief        definicion del brief (id, displayName, ...)
 * @param {object[]} args.items      NewsItem[] (sin raw)
 * @param {object[]} args.agentOutputs AgentOutput[] (anotados con displayName/unavailable)
 * @param {string} args.date         YYYY-MM-DD
 * @param {string} [args.timezone]
 * @returns {string} markdown
 */
function renderBrief({ brief, items, agentOutputs, date, timezone }) {
  const tz = timezone || 'America/Bogota';
  const itemsById = new Map((items || []).map((it) => [it.id, it]));
  const sourceTypes = [...new Set((items || []).map((it) => it.sourceType))];

  const head = [
    `# ${brief.displayName || brief.id} — Brief diario`,
    '',
    `> ${fmtDateTime(new Date().toISOString(), tz)} · ${(items || []).length} noticias` +
      (sourceTypes.length ? ` · fuentes: ${sourceTypes.join(', ')}` : ''),
    '',
  ];

  const agentSections = (agentOutputs || []).map((o) => renderAgentSection(o, itemsById, tz));

  const footer = [
    '---',
    '',
    '_Generado por **news-extractor** (Castle Capital). El Resultado es un Eco._',
    '_Esto es información, no asesoría de inversión. Verifica las fuentes antes de operar._',
    '',
  ];

  return [
    head.join('\n'),
    ...agentSections,
    renderNewsList(items || [], tz),
    footer.join('\n'),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
}

module.exports = { renderBrief, fmtDateTime, sentimentLine };
