#!/usr/bin/env node
'use strict';

/**
 * Agente IA de referencia: "Sintetizador IA" (Castle Capital).
 *
 * Es un eslabon 100% intercambiable. Lee un AgentInput (JSON) por stdin, llama
 * la Anthropic Messages API con `fetch` nativo (zero-dep, sin SDK) y emite un
 * AgentOutput (JSON) por stdout. Demuestra el contrato desde el dia 1.
 *
 *   Claves/config (solo env, nunca argumentos ni YAML):
 *     ANTHROPIC_API_KEY   (obligatoria)
 *     NEWS_AI_MODEL       (opcional; default claude-sonnet-4-6)
 *
 * Salida AgentOutput: { schemaVersion, agentId, summary, sentiment, signals,
 *                       highlights, warnings }.
 *
 * En error: mensaje a stderr + exit(1) -> el connector degrada con elegancia.
 */

const AGENT_ID = 'ai-synthesizer';
const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_ITEMS = 40;

function fail(message, detail) {
  process.stderr.write(`[${AGENT_ID}] ${message}${detail ? `: ${detail}` : ''}\n`);
  process.exit(1);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

/** Extrae el primer objeto JSON de un texto (tolera fences/prosa). */
function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no se encontro objeto JSON en la respuesta');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function compactItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS).map((it) => ({
    id: it.id,
    title: it.title,
    source: it.source,
    publishedAt: it.publishedAt || null,
    tickers: it.tickers || [],
    sentiment: it.sentiment || null,
    summary: typeof it.summary === 'string' ? it.summary.slice(0, 240) : '',
  }));
}

function buildSystemPrompt(language) {
  return [
    'Eres el "Sintetizador IA" de Castle Capital, una firma de inversion de elite con sede en Armenia, Colombia.',
    'Operas con dos lentes: El Matematico (todo es patron, variable y probabilidad) y El Estratega (el mercado es psicologico; la ventaja es la imperturbabilidad).',
    'Tu trabajo: convertir un lote de noticias en un brief accionable, preciso y sobrio. Sin humo, sin hype, sin promesas.',
    'Reglas estrictas:',
    '- Solo usa la informacion provista en los items. NO inventes hechos, cifras ni fuentes (principio No Invention).',
    '- Cita los items por su "id" en signals.refs y en highlights.itemId.',
    '- sentiment.score en [-1,1]; label en {bullish, neutral, bearish}.',
    '- Tono profesional, cercano y de alta autoridad. Es informacion, no asesoria de inversion.',
    `- Responde en ${language === 'en' ? 'ingles' : 'espanol'}.`,
    'Devuelve UNICAMENTE un objeto JSON valido (sin markdown, sin texto extra) con esta forma:',
    '{ "schemaVersion":"1.0", "agentId":"ai-synthesizer", "summary":"<markdown: narrativa del brief, 2-4 parrafos>",',
    '  "sentiment":{"score":<num>,"label":"bullish|neutral|bearish"},',
    '  "signals":[{"label":"...","direction":"bullish|bearish|neutral","confidence":<0..1>,"rationale":"...","refs":["<itemId>"]}],',
    '  "highlights":[{"itemId":"<id>","why":"...","importance":<1..5>}],',
    '  "warnings":["..."] }',
  ].join('\n');
}

function buildUserPrompt(input) {
  const brief = input.brief || {};
  const q = brief.query || {};
  const items = compactItems(input.items);
  return [
    `Tema: ${brief.display_name || brief.id}`,
    `Keywords: ${(q.keywords || []).join(', ') || '-'}`,
    `Tickers: ${(q.tickers || []).join(', ') || '-'}`,
    `Fecha de referencia previa: ${(input.context && input.context.previousBriefDate) || 'n/a'}`,
    '',
    `Noticias (${items.length}):`,
    JSON.stringify(items, null, 0),
    '',
    'Genera el brief en el formato JSON especificado. Prioriza señales accionables y advierte sobre ruido o baja confiabilidad cuando aplique.',
  ].join('\n');
}

async function callAnthropic({ apiKey, model, system, user }) {
  const body = {
    model,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  };
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch (err) {
    throw new Error(`fallo de red llamando a Anthropic (${err.message})`);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status} ${txt.slice(0, 160)}`);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') {
    throw new Error('Anthropic refuso la solicitud (stop_reason=refusal)');
  }
  const text = (Array.isArray(data.content) ? data.content : [])
    .filter((b) => b && b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('respuesta de Anthropic sin texto');
  return text;
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch (err) {
    fail('AgentInput por stdin no es JSON valido', err.message);
  }
  if (!input || !input.brief) fail('AgentInput invalido: falta "brief"');

  const items = Array.isArray(input.items) ? input.items : [];
  // Caso sin noticias: emitir un AgentOutput valido y minimal (sin gastar API ni requerir clave).
  if (items.length === 0) {
    process.stdout.write(
      JSON.stringify({
        schemaVersion: '1.0',
        agentId: AGENT_ID,
        summary: `Sin noticias nuevas para **${input.brief.display_name || input.brief.id}** en la ventana configurada. Mantener la posicion y revisar en el proximo ciclo.`,
        sentiment: { score: 0, label: 'neutral' },
        signals: [],
        highlights: [],
        warnings: ['No hubo items que analizar en este run.'],
      }),
    );
    return;
  }

  // A partir de aqui SI se llama a la API: la clave es obligatoria.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) fail('falta ANTHROPIC_API_KEY en el entorno');
  const model = (process.env.NEWS_AI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;

  let text;
  try {
    text = await callAnthropic({
      apiKey,
      model,
      system: buildSystemPrompt(input.brief.language || 'es'),
      user: buildUserPrompt(input),
    });
  } catch (err) {
    fail('llamada a Anthropic fallo', err.message);
  }

  let output;
  try {
    output = extractJson(text);
  } catch (err) {
    fail('no se pudo parsear el AgentOutput del modelo', err.message);
  }

  // Garantizar campos minimos del contrato.
  output.schemaVersion = '1.0';
  output.agentId = AGENT_ID;
  if (typeof output.summary !== 'string' || !output.summary.trim()) {
    fail('el modelo no produjo "summary"');
  }
  process.stdout.write(JSON.stringify(output));
}

main().catch((err) => fail('error inesperado', err && err.message));
