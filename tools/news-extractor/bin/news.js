#!/usr/bin/env node
'use strict';

/**
 * news-extractor CLI — la fuente de la verdad (CLI First).
 * Toda accion de la web mapea 1:1 a un comando aqui. La UI nunca reimplementa logica.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const { loadEnv } = require('../src/core/env');
loadEnv(); // popular process.env desde .env (no sobrescribe el entorno)

const logger = require('../src/core/logger');
const cfg = require('../src/core/config-loader');
const runner = require('../src/core/runner');
const sources = require('../src/sources');
const { createRegistry } = require('../src/agents/registry');
const connector = require('../src/agents/connector');
const { normalizeItem, stripRaw } = require('../src/core/normalizer');
const { sinceTimestamp } = require('../src/core/duration');
const { createPaths, today } = require('../src/storage/paths');
const store = require('../src/storage/store');
const { HttpClient } = require('../src/core/http-client');
const telegram = require('../src/notify/telegram');
const schedule = require('../src/core/schedule');

const out = (...a) => process.stdout.write(`${a.join(' ')}\n`);

/** Parser de argumentos minimo: posicionales + --flags y --key value. */
function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function maskKey(present) {
  return present ? 'OK' : '— (ausente)';
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

async function cmdRun(flags) {
  const opts = {
    dryRun: !!flags['dry-run'],
    noAgents: !!flags['no-agents'],
    force: !!flags.force,
    requestedAgents: typeof flags.agent === 'string' ? [flags.agent] : undefined,
  };
  if (flags.all || !flags.topic) {
    const results = await runner.runAll(opts);
    for (const r of results) {
      if (r.error) out(`✗ ${r.topic}: ${r.error}`);
      else if (r.skipped) out(`• ${r.topic}: omitido (${r.skipped})`);
      else out(`✓ ${r.topic} [${r.date}] noticias=${r.counts.kept} agentes=${r.agents.length} telegram=${r.notified}${r.briefPath ? ` → ${path.relative(cfg.getRepoRoot(), r.briefPath)}` : ''}`);
    }
    return;
  }
  const r = await runner.runTopic(String(flags.topic), opts);
  if (r.skipped) { out(`• ${r.topic}: omitido (${r.skipped})`); return; }
  if (opts.dryRun) {
    out(`--- DRY RUN: ${r.topic} [${r.date}] (sin persistir) ---`);
    out(`noticias=${r.counts.kept} (descartadas dup=${r.counts.removedDup})`);
    out('');
    out(r.markdown);
  } else {
    out(`✓ ${r.topic} [${r.date}] noticias=${r.counts.kept} agentes=${r.agents.length} telegram=${r.notified}`);
    if (r.briefPath) out(`  brief: ${path.relative(cfg.getRepoRoot(), r.briefPath)}`);
  }
}

function cmdListTopics() {
  const briefs = cfg.loadAllBriefs();
  if (briefs.length === 0) { out('No hay temas. Crea uno con: news add-topic <id>'); return; }
  out('Temas configurados:');
  for (const b of briefs) {
    const srcs = b.sources.map((s) => s.type).join(', ');
    out(`  ${b.enabled ? '●' : '○'} ${b.id}  —  ${b.displayName}`);
    out(`     fuentes: ${srcs} · agentes: ${b.agents.join(', ') || '—'} · cron: ${b.schedule.cron || '—'}`);
  }
}

function cmdShowTopic(id) {
  const b = cfg.loadBriefById(id);
  out(JSON.stringify(b, null, 2));
}

function findBriefFile(id) {
  for (const f of cfg.listBriefFiles()) {
    const raw = cfg.readYaml(f);
    if (raw && raw.brief && raw.brief.id === id) return { file: f, raw };
  }
  return null;
}

function setTopicEnabled(id, enabled) {
  const found = findBriefFile(id);
  if (!found) throw new Error(`Tema no encontrado: ${id}`);
  found.raw.brief = found.raw.brief || {};
  found.raw.brief.enabled = enabled;
  store.writeFileAtomic(found.file, yaml.dump(found.raw, { lineWidth: 100 }));
  out(`${enabled ? 'Habilitado' : 'Deshabilitado'}: ${id}`);
}

function cmdAddTopic(id, flags) {
  if (!cfg.TOPIC_ID_RE.test(id)) throw new Error(`id invalido (usa minusculas, numeros, guiones): ${id}`);
  if (findBriefFile(id)) throw new Error(`El tema ya existe: ${id}`);
  let raw;
  if (typeof flags.from === 'string') {
    const base = findBriefFile(flags.from);
    if (!base) throw new Error(`Template no encontrado: ${flags.from}`);
    raw = base.raw;
    raw.brief.id = id;
    raw.brief.display_name = id;
  } else {
    raw = {
      brief: { id, display_name: id, language: 'es', enabled: true },
      query: { keywords: [], tickers: [], topics: [], since: '24h', max_items: 30 },
      sources: [{ type: 'rss' }],
      dedup: { strategy: 'both', window: '48h' },
      agents: ['ai-synthesizer'],
      schedule: { cron: '0 7 * * *', timezone: 'America/Bogota' },
      output: { markdown: true, json: true },
      notify: { telegram: true },
    };
  }
  const file = path.join(cfg.briefsDir(), `${id}.yaml`);
  store.writeFileAtomic(file, yaml.dump(raw, { lineWidth: 100 }));
  out(`Tema creado: ${path.relative(cfg.getRepoRoot(), file)}`);
  out('Edita el YAML para ajustar keywords, tickers y fuentes.');
}

function cmdSources(positionals, flags) {
  const sub = positionals[0];
  if (sub === 'list' || !sub) {
    out('Fuentes registradas:');
    for (const s of sources.describeSources()) {
      out(`  ${s.type}  —  key: ${s.requiresKey ? `${s.envKey} [${maskKey(s.keyPresent)}]` : 'no requiere'}`);
    }
    return Promise.resolve();
  }
  if (sub === 'test') {
    return cmdSourcesTest(positionals[1], flags);
  }
  throw new Error(`subcomando sources desconocido: ${sub}`);
}

async function cmdSourcesTest(type, flags) {
  if (!type) throw new Error('uso: news sources test <type> --topic <id>');
  if (!flags.topic) throw new Error('falta --topic <id>');
  const brief = cfg.loadBriefById(String(flags.topic));
  const adapter = sources.getSource(type);
  if (adapter.requiresKey && !process.env[adapter.envKey]) {
    throw new Error(`la fuente ${type} requiere ${adapter.envKey} en el entorno`);
  }
  const settings = cfg.loadSettings();
  const http = new HttpClient({ timeoutMs: settings.http.timeout_ms, retries: settings.http.retries, minHostIntervalMs: settings.http.min_host_interval_ms, logger });
  const sinceTs = sinceTimestamp(brief.query.since, 'since');
  const query = { keywords: brief.query.keywords, tickers: brief.query.tickers, topics: brief.query.topics, sinceTs, sinceIso: new Date(sinceTs).toISOString(), limit: brief.query.maxItems };
  const raws = await adapter.fetch(query, { http, logger, options: {} });
  const items = [];
  for (const raw of raws) {
    const item = normalizeItem(adapter.mapRaw(raw), { source: type, sourceType: type, language: brief.language, logger });
    if (item) items.push(stripRaw(item));
  }
  out(`${type}: ${items.length} items normalizados (no persistido)`);
  for (const it of items.slice(0, 15)) {
    out(`  • ${it.title}`);
    out(`    ${it.url}  [${it.source}${it.publishedAt ? ` · ${it.publishedAt.slice(0, 16)}` : ''}]`);
  }
}

function getRegistry() {
  const settings = cfg.loadSettings();
  const paths = createPaths(settings.resolved.outputDir);
  return createRegistry({ stateFile: paths.safeJoin('.agents-state.json'), logger });
}

async function cmdAgents(positionals, flags) {
  const sub = positionals[0];
  const registry = getRegistry();
  if (sub === 'list' || !sub) {
    out('Agentes registrados:');
    for (const m of registry.list()) {
      out(`  ${m.agent.enabled ? '●' : '○'} ${m.agent.id}  —  ${m.agent.displayName} (v${m.agent.version})`);
      out(`     transport: ${m.transport.type}${m.transport.command ? ` (${m.transport.command} ${m.transport.args.join(' ')})` : ''} · aplica: ${m.applies_to.join(', ') || 'todos'}`);
    }
    return;
  }
  if (sub === 'enable' || sub === 'disable') {
    const id = positionals[1];
    if (!id) throw new Error(`uso: news agents ${sub} <id>`);
    registry.setEnabled(id, sub === 'enable');
    out(`${sub === 'enable' ? 'Habilitado' : 'Deshabilitado'}: ${id}`);
    return;
  }
  if (sub === 'test') {
    await cmdAgentsTest(positionals[1], flags, registry);
    return;
  }
  throw new Error(`subcomando agents desconocido: ${sub}`);
}

async function cmdAgentsTest(id, flags, registry) {
  if (!id) throw new Error('uso: news agents test <id> --topic <id>');
  if (!flags.topic) throw new Error('falta --topic <id>');
  const manifest = registry.get(id);
  if (!manifest) throw new Error(`Agente no encontrado: ${id}`);
  const brief = cfg.loadBriefById(String(flags.topic));
  const settings = cfg.loadSettings();
  // Round-trip con un item de ejemplo (offline si el agente no llama APIs reales con items=[]).
  const sample = flags['with-sample']
    ? [{ id: 'sample-1', source: 'demo', sourceType: 'demo', title: 'Noticia de ejemplo', url: 'https://example.com/a', summary: 'Resumen de ejemplo', publishedAt: new Date().toISOString(), tickers: brief.query.tickers, topics: [], sentiment: null }]
    : [];
  const input = connector.buildAgentInput({ brief, items: sample, runId: `test#${brief.id}`, context: {} });
  const http = new HttpClient({ logger });
  const output = await connector.runAgent({ manifest, input, ctx: { logger, toolRoot: settings.resolved.toolRoot, http } });
  out(`Agente ${id} OK (round-trip ${output.durationMs}ms)`);
  out(JSON.stringify({ ...output, durationMs: undefined }, null, 2));
}

function cmdBrief(positionals, flags) {
  const sub = positionals[0];
  const settings = cfg.loadSettings();
  const paths = createPaths(settings.resolved.outputDir);
  if (sub === 'latest') {
    const topic = flags.topic ? String(flags.topic) : null;
    const topics = topic ? [topic] : cfg.loadAllBriefs().map((b) => b.id);
    for (const t of topics) {
      let dir;
      try { dir = paths.briefDir(t); } catch { continue; }
      if (!fs.existsSync(dir)) { out(`${t}: sin briefs aun`); continue; }
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
      if (!files.length) { out(`${t}: sin briefs aun`); continue; }
      const latest = path.join(dir, files[files.length - 1]);
      out(`=== ${t} → ${path.relative(cfg.getRepoRoot(), latest)} ===`);
      if (topic) out(store.readText(latest, ''));
    }
    return;
  }
  if (sub === 'history') {
    const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 20;
    const rows = store.readJsonlTail(paths.runHistoryFile(), 500)
      .filter((r) => (flags.topic ? r.topic === String(flags.topic) : true))
      .slice(-limit);
    if (!rows.length) { out('Sin historial de runs.'); return; }
    out('Historial de runs:');
    for (const r of rows) {
      out(`  ${r.ts.slice(0, 16)} ${r.topic} [${r.date}] noticias=${r.counts.kept} telegram=${r.notified}`);
    }
    return;
  }
  throw new Error('uso: news brief latest|history [--topic <id>] [--limit N]');
}

function cmdSchedule(positionals) {
  const sub = positionals[0];
  const settings = cfg.loadSettings();
  if (sub === 'install') {
    const r = schedule.install(settings);
    out(`LaunchAgent ${r.loaded ? 'instalado y cargado' : 'escrito (carga manual requerida)'}: ${r.file}`);
    out(`Horarios: ${r.intervals.map((i) => `${String(i.Hour).padStart(2, '0')}:${String(i.Minute).padStart(2, '0')}${i.Weekday != null ? ` (dia ${i.Weekday})` : ''}`).join(', ')}`);
    if (r.detail) out(`launchctl: ${r.detail}`);
    return;
  }
  if (sub === 'uninstall') {
    const r = schedule.uninstall();
    out(r.removed ? `LaunchAgent removido: ${r.file}` : `No instalado (${r.reason})`);
    return;
  }
  if (sub === 'status' || !sub) {
    const s = schedule.status();
    out(`Label: ${s.label}`);
    out(`Instalado: ${s.installed ? 'si' : 'no'} (${s.file})`);
    out(`Cargado en launchd: ${s.loaded ? 'si' : 'no'}`);
    return;
  }
  throw new Error('uso: news schedule install|uninstall|status');
}

async function cmdServe(flags) {
  const port = Number(flags.port) > 0 ? Number(flags.port) : 8730;
  const { startServer } = require('../src/web/server');
  await startServer({ port, logger });
  out(`Web UI local en http://127.0.0.1:${port}  (Ctrl-C para detener)`);
}

function cmdDoctor() {
  out('news-extractor doctor');
  out('======================');
  let warns = 0;
  let fails = 0;
  const ok = (m) => out(`  ✓ ${m}`);
  const warn = (m) => { out(`  ⚠ ${m}`); warns += 1; };
  const fail = (m) => { out(`  ✗ ${m}`); fails += 1; };

  // Node
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok(`Node ${process.versions.node} (fetch nativo)`); else fail(`Node ${process.versions.node} < 18 (sin fetch)`);

  // Config
  let settings;
  try { settings = cfg.loadSettings(); ok('settings.yaml cargado'); } catch (e) { fail(`settings.yaml: ${e.message}`); }

  let briefs = [];
  try { briefs = cfg.loadAllBriefs(); ok(`${briefs.length} brief(s) validos`); }
  catch (e) { fail(`briefs: ${e.message}`); }

  // Output dir escribible
  if (settings) {
    try {
      store.ensureDir(settings.resolved.outputDir);
      const probe = path.join(settings.resolved.outputDir, '.doctor-probe');
      fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
      ok(`directorio de salida escribible: ${path.relative(cfg.getRepoRoot(), settings.resolved.outputDir)}`);
    } catch (e) { fail(`salida no escribible: ${e.message}`); }
  }

  // Claves de fuentes
  for (const s of sources.describeSources()) {
    if (!s.requiresKey) continue;
    if (s.keyPresent) ok(`${s.type}: ${s.envKey} presente`);
    else warn(`${s.type}: ${s.envKey} ausente (la fuente se omitira)`);
  }

  // Claves agente IA + Telegram
  if (process.env.ANTHROPIC_API_KEY) ok('ANTHROPIC_API_KEY presente'); else warn('ANTHROPIC_API_KEY ausente (agente IA fallara)');
  if (telegram.isConfigured()) ok('Telegram configurado'); else warn('Telegram no configurado (TELEGRAM_BOT_TOKEN/CHAT_ID)');

  // Agentes
  try {
    const reg = getRegistry();
    const list = reg.list();
    ok(`${list.length} agente(s) registrados${list.length ? ` (${list.map((m) => m.agent.id).join(', ')})` : ''}`);
  } catch (e) { fail(`agentes: ${e.message}`); }

  // Feeds RSS https
  for (const b of briefs) {
    for (const s of b.sources) {
      const feeds = s.options && Array.isArray(s.options.feeds) ? s.options.feeds : [];
      for (const f of feeds) {
        if (!/^https:\/\//i.test(f)) fail(`feed no-https en ${b.id}: ${f}`);
      }
    }
  }

  // launchd
  try {
    const s = schedule.status();
    if (s.installed) ok(`launchd: instalado (cargado=${s.loaded})`); else out('  • launchd: no instalado (news schedule install)');
  } catch { /* no-op */ }

  out('======================');
  out(`Resultado: ${fails === 0 ? (warns === 0 ? 'TODO OK' : `OK con ${warns} aviso(s)`) : `${fails} fallo(s), ${warns} aviso(s)`}`);
  return fails === 0 ? 0 : 1;
}

function cmdHelp() {
  out(`news-extractor — extractor de noticias diario (Castle Capital)

Uso: news <comando> [opciones]

  run [--topic <id>] [--all] [--dry-run] [--no-agents] [--agent <id>]
  list-topics
  show-topic <id>
  add-topic <id> [--from <topicId>]
  enable-topic <id> | disable-topic <id>
  sources list | sources test <type> --topic <id>
  agents list | agents enable <id> | agents disable <id> | agents test <id> --topic <id> [--with-sample]
  brief latest [--topic <id>] | brief history [--topic <id>] [--limit N]
  schedule install | uninstall | status
  serve [--port 8730]
  doctor
`);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function main() {
  const [, , command, ...rest] = process.argv;
  const { positionals, flags } = parseArgs(rest);

  switch (command) {
    case 'run': return cmdRun(flags);
    case 'list-topics': return cmdListTopics();
    case 'show-topic': return cmdShowTopic(positionals[0]);
    case 'add-topic': return cmdAddTopic(positionals[0], flags);
    case 'enable-topic': return setTopicEnabled(positionals[0], true);
    case 'disable-topic': return setTopicEnabled(positionals[0], false);
    case 'sources': return cmdSources(positionals, flags);
    case 'agents': return cmdAgents(positionals, flags);
    case 'brief': return cmdBrief(positionals, flags);
    case 'schedule': return cmdSchedule(positionals);
    case 'serve': return cmdServe(flags);
    case 'doctor': return process.exit(cmdDoctor());
    case 'help': case '--help': case '-h': case undefined: return cmdHelp();
    default:
      process.stderr.write(`Comando desconocido: ${command}\n`);
      cmdHelp();
      return process.exit(2);
  }
}

main().catch((err) => {
  logger.error('Comando fallo', { error: err && err.message });
  process.stderr.write(`Error: ${err && err.message}\n`);
  process.exit(1);
});
