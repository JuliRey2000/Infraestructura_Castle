'use strict';

const fs = require('fs');
const path = require('path');

const cfg = require('../core/config-loader');
const runner = require('../core/runner');
const sources = require('../sources');
const store = require('../storage/store');
const { createPaths } = require('../storage/paths');
const { createRegistry } = require('../agents/registry');
const telegram = require('../notify/telegram');
const schedule = require('../core/schedule');

/**
 * Capa API de la web: CADA handler delega en la MISMA funcion de core que el CLI.
 * Sin logica de negocio aqui. Devuelve { status, body } (body se serializa JSON).
 */

function paths() {
  const settings = cfg.loadSettings();
  return { settings, paths: createPaths(settings.resolved.outputDir) };
}

function registry() {
  const { settings, paths: p } = paths();
  void settings;
  return createRegistry({ stateFile: p.safeJoin('.agents-state.json') });
}

function listTopics() {
  const briefs = cfg.loadAllBriefs().map((b) => ({
    id: b.id,
    displayName: b.displayName,
    enabled: b.enabled,
    sources: b.sources.map((s) => s.type),
    agents: b.agents,
    cron: b.schedule.cron,
    tickers: b.query.tickers,
  }));
  return { status: 200, body: { topics: briefs } };
}

function getTopic(id) {
  try {
    return { status: 200, body: cfg.loadBriefById(id) };
  } catch (e) {
    return { status: 404, body: { error: e.message } };
  }
}

async function runTopic(id, opts) {
  const summary = await runner.runTopic(id, {
    dryRun: !!(opts && opts.dryRun),
    noAgents: !!(opts && opts.noAgents),
  });
  return { status: 200, body: summary };
}

function getBrief(topic, date) {
  const { paths: p } = paths();
  let dir;
  try {
    dir = p.briefDir(topic);
  } catch (e) {
    return { status: 400, body: { error: e.message } };
  }
  if (!fs.existsSync(dir)) return { status: 404, body: { error: 'sin briefs' } };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  if (!files.length) return { status: 404, body: { error: 'sin briefs' } };
  const targetDate = date || files[files.length - 1].slice(0, -3);
  let file;
  try {
    file = p.briefFile(topic, targetDate);
  } catch (e) {
    return { status: 400, body: { error: e.message } };
  }
  const markdown = store.readText(file, null);
  if (markdown == null) return { status: 404, body: { error: 'brief no encontrado' } };
  return {
    status: 200,
    body: { topic, date: targetDate, dates: files.map((f) => f.slice(0, -3)), markdown },
  };
}

function listAgents() {
  const reg = registry();
  return {
    status: 200,
    body: {
      agents: reg.list().map((m) => ({
        id: m.agent.id,
        displayName: m.agent.displayName,
        version: m.agent.version,
        enabled: m.agent.enabled,
        transport: m.transport.type,
        appliesTo: m.applies_to,
      })),
    },
  };
}

function setAgent(id, enabled) {
  try {
    registry().setEnabled(id, enabled);
    return { status: 200, body: { id, enabled } };
  } catch (e) {
    return { status: 404, body: { error: e.message } };
  }
}

function history(topic, limit) {
  const { paths: p } = paths();
  const rows = store
    .readJsonlTail(p.runHistoryFile(), 500)
    .filter((r) => (topic ? r.topic === topic : true))
    .slice(-(limit > 0 ? limit : 30))
    .reverse();
  return { status: 200, body: { history: rows } };
}

function settings() {
  const { settings: s } = paths();
  return {
    status: 200,
    body: {
      timezone: s.schedule.timezone,
      output: s.output,
      http: s.http,
      ai: { default_model: s.ai.default_model, keyPresent: !!process.env.ANTHROPIC_API_KEY },
      telegram: { enabled: s.notify.telegram.enabled, configured: telegram.isConfigured() },
      sources: sources.describeSources(),
      schedule: schedule.status(),
    },
  };
}

function health() {
  return { status: 200, body: { ok: true, ts: new Date().toISOString() } };
}

module.exports = {
  listTopics,
  getTopic,
  runTopic,
  getBrief,
  listAgents,
  setAgent,
  history,
  settings,
  health,
};
