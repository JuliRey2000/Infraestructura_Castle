'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { AgentError } = require('../../core/errors');
const { getToolRoot, TOPIC_ID_RE } = require('../../core/config-loader');

/**
 * Transport "aiox-squad": usa Claude Code LOCAL (binario `claude`, modo headless
 * `-p`) como eslabon de analisis, en vez de una API externa con clave.
 *
 * Idea: un "agente experto" = una persona + conocimiento que TU guardas local
 * (estilo copy-chief). El transport carga esa persona como system prompt, le pasa
 * las noticias del AgentInput, e invoca `claude -p` para que emita el AgentOutput.
 *
 *   Donde vive el experto:  config/experts/<id>/persona.md   (requerido)
 *                           config/experts/<id>/knowledge/   (opcional)
 *   Como se vincula:        manifiesto con transport.type: aiox-squad
 *
 * Autenticacion: usa tu LOGIN/suscripcion de Claude Code, NO una API key. Por eso
 * se ELIMINA ANTHROPIC_API_KEY del entorno del subproceso (para no caer en
 * facturacion por API). Se puede conservar con NEWS_CLAUDE_KEEP_API_KEY=1.
 *
 * Seguridad: spawn(cmd, argsArray, { shell:false }). Nunca concatena shell ni
 * interpola input en un comando. Args como lista explicita. Falla con AgentError
 * (el connector degrada con elegancia: marca la seccion como no disponible).
 */

const DEFAULT_BIN = 'claude';
const DEFAULT_TIMEOUT_MS = 180000; // claude headless puede tardar; 3 min por defecto
const MIN_TIMEOUT_MS = 120000; // piso: <2 min vuelve el feature inestable
const DEFAULT_PERMISSION_MODE = 'dontAsk'; // headless sin prompts y sin conceder herramientas
const MAX_SYSTEM_PROMPT = 100 * 1024; // cap del --append-system-prompt (persona + conocimiento)
const MAX_KNOWLEDGE = 60 * 1024; // cap del conocimiento concatenado
const MAX_OUT = 4 * 1024 * 1024; // cap de stdout leido
const MAX_ITEMS = 40;

/** Raiz de los expertos. Override por env NEWS_EXPERTS_DIR (util en tests). */
function expertsDir() {
  const override = process.env.NEWS_EXPERTS_DIR;
  if (override && override.trim()) return path.resolve(override.trim());
  return path.join(getToolRoot(), 'config', 'experts');
}

/** Directorio de trabajo neutral para `claude` (evita heredar el CLAUDE.md del repo). */
function claudeCwd() {
  const dir = path.join(os.tmpdir(), 'news-extractor-claude');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    return os.tmpdir();
  }
  return dir;
}

/** Carga persona.md (requerido) + knowledge/* (opcional, capado) de un experto. */
function loadExpert(expertId) {
  if (typeof expertId !== 'string' || !TOPIC_ID_RE.test(expertId)) {
    throw new AgentError(`id de experto invalido: ${expertId}`, { context: { expertId } });
  }
  const dir = path.join(expertsDir(), expertId);
  const personaFile = path.join(dir, 'persona.md');
  let persona;
  try {
    persona = fs.readFileSync(personaFile, 'utf8');
  } catch (err) {
    throw new AgentError(
      `Persona no encontrada: ${path.relative(getToolRoot(), personaFile)}`,
      { context: { expertId }, cause: err },
    );
  }
  if (!persona.trim()) {
    throw new AgentError(`persona.md vacia para "${expertId}"`, { context: { expertId } });
  }

  let knowledge = '';
  const kdir = path.join(dir, 'knowledge');
  if (fs.existsSync(kdir)) {
    const files = fs
      .readdirSync(kdir)
      .filter((f) => /\.(md|txt)$/i.test(f))
      .sort();
    const parts = [];
    let total = 0;
    for (const f of files) {
      let content;
      try {
        content = fs.readFileSync(path.join(kdir, f), 'utf8');
      } catch {
        continue;
      }
      if (total + content.length > MAX_KNOWLEDGE) {
        parts.push(`## ${f}\n${content.slice(0, Math.max(0, MAX_KNOWLEDGE - total))}`);
        break;
      }
      total += content.length;
      parts.push(`## ${f}\n${content}`);
    }
    knowledge = parts.join('\n\n');
  }
  return { persona: persona.trim(), knowledge: knowledge.trim() };
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

function outputContract(language) {
  return [
    '# Contrato de salida (OBLIGATORIO)',
    'Eres un eslabon de analisis dentro de un pipeline automatizado. NO uses herramientas, NO hagas preguntas.',
    'Tu UNICA salida es un objeto JSON valido: sin markdown alrededor, sin texto antes ni despues.',
    'Solo usa la informacion de los items provistos. NO inventes hechos, cifras ni fuentes (principio No Invention).',
    `Responde en ${language === 'en' ? 'ingles' : 'espanol'}. Es informacion, no asesoria de inversion.`,
    'Cita los items por su "id" en signals.refs y en highlights.itemId.',
    'Forma exacta del JSON:',
    '{ "schemaVersion":"1.0", "agentId":"<id>", "summary":"<markdown: narrativa del brief, 2-4 parrafos>",',
    '  "sentiment":{"score":<-1..1>,"label":"bullish|neutral|bearish"},',
    '  "signals":[{"label":"...","direction":"bullish|bearish|neutral","confidence":<0..1>,"rationale":"...","refs":["<itemId>"]}],',
    '  "highlights":[{"itemId":"<id>","why":"...","importance":<1..5>}],',
    '  "warnings":["..."] }',
  ].join('\n');
}

function buildSystemPrompt({ persona, knowledge, language }) {
  const blocks = [persona];
  if (knowledge) blocks.push(`# Base de conocimiento (referencia)\n${knowledge}`);
  blocks.push(outputContract(language));
  const full = blocks.join('\n\n');
  if (full.length > MAX_SYSTEM_PROMPT) {
    throw new AgentError(
      `system prompt demasiado grande (${full.length} > ${MAX_SYSTEM_PROMPT}). Reduce persona/knowledge.`,
    );
  }
  return full;
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
    JSON.stringify(items),
    '',
    'Genera el brief en el formato JSON especificado. Prioriza senales accionables.',
  ].join('\n');
}

/** Extrae el primer objeto JSON de un texto (tolera fences/prosa). */
function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new AgentError('no se encontro objeto JSON en la respuesta de claude');
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch (err) {
    throw new AgentError('respuesta de claude no es JSON parseable', { cause: err });
  }
}

/**
 * Parsea el stdout de `claude --output-format json`. Devuelve el texto final del
 * asistente (string) o, si ya viene estructurado, el objeto. Lanza si is_error.
 */
function parseCliEnvelope(stdout, agentId) {
  let env;
  try {
    env = JSON.parse(stdout);
  } catch {
    return stdout; // no era JSON envelope; tratar como texto crudo
  }
  if (env && typeof env === 'object' && !Array.isArray(env)) {
    if (env.is_error === true) {
      const detail = typeof env.result === 'string' ? env.result : env.subtype || 'error';
      throw new AgentError(`claude reporto error: ${String(detail).slice(0, 160)}`, {
        context: { agentId },
      });
    }
    if (typeof env.result === 'string') return env.result;
    if (env.result && typeof env.result === 'object') return env.result;
  }
  return stdout;
}

function minimalOutput(agentId, brief) {
  const name = (brief && (brief.display_name || brief.id)) || 'el tema';
  return {
    schemaVersion: '1.0',
    agentId,
    summary: `Sin noticias nuevas para **${name}** en la ventana configurada. Mantener la posicion y revisar en el proximo ciclo.`,
    sentiment: { score: 0, label: 'neutral' },
    signals: [],
    highlights: [],
    warnings: ['No hubo items que analizar en este run.'],
  };
}

/**
 * Ejecuta un agente experto via `claude -p` (Claude Code local).
 * @param {object} args
 * @param {object} args.manifest  manifiesto normalizado (transport.agent = id del experto)
 * @param {object} args.input     AgentInput
 * @param {object} args.ctx       { logger, signal }
 * @returns {Promise<object>} AgentOutput crudo (el connector lo valida)
 */
function invokeAioxSquad({ manifest, input, ctx }) {
  const t = (manifest && manifest.transport) || {};
  const agentId = (manifest && manifest.agent && manifest.agent.id) || 'aiox-squad';
  const expertId = t.agent || agentId;
  const logger = (ctx && ctx.logger) || { debug() {}, warn() {} };
  const brief = (input && input.brief) || {};

  // Sin noticias: round-trip valido y barato, SIN invocar a claude.
  const items = Array.isArray(input && input.items) ? input.items : [];
  if (items.length === 0) {
    return Promise.resolve(minimalOutput(agentId, brief));
  }

  let systemPrompt;
  try {
    const expert = loadExpert(expertId);
    systemPrompt = buildSystemPrompt({
      persona: expert.persona,
      knowledge: expert.knowledge,
      language: brief.language || 'es',
    });
  } catch (err) {
    return Promise.reject(err instanceof AgentError ? err : new AgentError(err.message, { cause: err }));
  }

  const userPrompt = buildUserPrompt(input);
  const command = t.command || process.env.NEWS_CLAUDE_BIN || DEFAULT_BIN;
  const model = t.model || process.env.NEWS_CLAUDE_MODEL || null;
  const permissionMode = process.env.NEWS_CLAUDE_PERMISSION_MODE || DEFAULT_PERMISSION_MODE;
  const timeoutMs = Math.max(Number(t.timeout_ms) > 0 ? Number(t.timeout_ms) : DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS);
  const extraArgs = Array.isArray(t.args) ? t.args.map((a) => String(a)) : [];

  const argv = ['-p', '--output-format', 'json', '--append-system-prompt', systemPrompt, '--permission-mode', permissionMode, '--no-session-persistence'];
  if (model) argv.push('--model', String(model));
  for (const a of extraArgs) argv.push(a);

  // Entorno: heredar todo salvo la API key (forzar auth por suscripcion).
  const childEnv = { ...process.env };
  if (!process.env.NEWS_CLAUDE_KEEP_API_KEY) {
    delete childEnv.ANTHROPIC_API_KEY;
    delete childEnv.ANTHROPIC_AUTH_TOKEN;
  }

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, argv, {
        cwd: claudeCwd(),
        shell: false, // CRITICO: nunca shell
        env: childEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return reject(new AgentError('No se pudo lanzar claude (spawn fallo)', { context: { command, agentId }, cause: err }));
    }

    const outChunks = [];
    const errChunks = [];
    let outLen = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new AgentError(`Timeout de claude (${timeoutMs}ms)`, { context: { agentId, command } }));
    }, timeoutMs);

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(new AgentError('Agente abortado', { context: { agentId } }));
    };
    if (ctx && ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', (d) => {
      outLen += d.length;
      if (outLen <= MAX_OUT) outChunks.push(d);
    });
    child.stderr.on('data', (d) => errChunks.push(d));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new AgentError(`No se pudo ejecutar "${command}" (¿esta instalado claude?)`, { context: { agentId, command }, cause: err }));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stderr = Buffer.concat(errChunks).toString('utf8').trim();
      if (stderr) logger.debug('claude stderr', { agentId, stderr: stderr.slice(0, 500) });
      if (code !== 0) {
        return reject(new AgentError(`claude salio con codigo ${code}`, { context: { agentId, command, code, stderr: stderr.slice(0, 300) } }));
      }
      const stdout = Buffer.concat(outChunks).toString('utf8').trim();
      if (!stdout) return reject(new AgentError('claude no produjo salida', { context: { agentId } }));
      try {
        const result = parseCliEnvelope(stdout, agentId);
        resolve(typeof result === 'object' ? result : extractJson(result));
      } catch (err) {
        reject(err instanceof AgentError ? err : new AgentError('fallo parseando la salida de claude', { context: { agentId }, cause: err }));
      }
    });

    try {
      child.stdin.write(userPrompt);
      child.stdin.end();
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill('SIGKILL');
        reject(new AgentError('No se pudo escribir el prompt a claude', { context: { agentId }, cause: err }));
      }
    }
  });
}

module.exports = { invokeAioxSquad, type: 'aiox-squad' };
