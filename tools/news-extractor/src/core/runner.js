'use strict';

const fs = require('fs');
const path = require('path');

const baseLogger = require('./logger');
const { HttpClient } = require('./http-client');
const { loadSettings, loadBriefById, loadAllBriefs } = require('./config-loader');
const { sinceTimestamp } = require('./duration');
const { normalizeItem, stripRaw } = require('./normalizer');
const { dedupe } = require('./dedup');
const sources = require('../sources');
const { createPaths, today, DATE_RE } = require('../storage/paths');
const store = require('../storage/store');
const { renderBrief } = require('../render/markdown');
const telegram = require('../notify/telegram');
const { createRegistry } = require('../agents/registry');
const connector = require('../agents/connector');
const { SourceError } = require('./errors');

/**
 * Pipeline de orquestacion: brief -> fetch -> normalize -> dedup -> persist ->
 * agentes -> render -> notify -> run-history.
 *
 * Degradacion elegante: una fuente o agente que falla no tumba el run; se loguea
 * y se registra. Nunca se traga el error.
 */

function buildContext(settings, logger) {
  const http = new HttpClient({
    timeoutMs: settings.http.timeout_ms,
    retries: settings.http.retries,
    minHostIntervalMs: settings.http.min_host_interval_ms,
    logger,
  });
  const paths = createPaths(settings.resolved.outputDir);
  const registry = createRegistry({
    stateFile: paths.safeJoin('.agents-state.json'),
    logger,
  });
  return { http, paths, registry };
}

/** Busca la fecha del brief previo (md mas reciente anterior a `date`). */
function findPreviousBriefDate(paths, topic, date) {
  try {
    const dir = paths.briefDir(topic);
    if (!fs.existsSync(dir)) return null;
    const dates = fs
      .readdirSync(dir)
      .map((f) => (f.endsWith('.md') ? f.slice(0, -3) : null))
      .filter((d) => d && DATE_RE.test(d) && d < date)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  } catch {
    return null;
  }
}

/** Ejecuta los adaptadores de fuente del brief y devuelve NewsItem[] crudos. */
async function collectItems(brief, ctx, logger) {
  const query = {
    keywords: brief.query.keywords,
    tickers: brief.query.tickers,
    topics: brief.query.topics,
    sinceTs: sinceTimestamp(brief.query.since, `${brief.id}.query.since`),
    sinceIso: new Date(sinceTimestamp(brief.query.since, `${brief.id}.query.since`)).toISOString(),
    limit: brief.query.maxItems,
  };

  const collected = [];
  const perSource = [];

  for (const sourceCfg of brief.sources) {
    const adapter = sources.getSource(sourceCfg.type);
    const sLogger = logger.child({ source: sourceCfg.type });

    if (adapter.requiresKey && !process.env[adapter.envKey]) {
      sLogger.warn('Fuente omitida: falta API key', { envKey: adapter.envKey });
      perSource.push({ type: sourceCfg.type, status: 'skipped_no_key', items: 0 });
      continue;
    }

    try {
      const raws = await adapter.fetch(query, {
        http: ctx.http,
        logger: sLogger,
        options: sourceCfg.options,
      });
      let kept = 0;
      for (const raw of Array.isArray(raws) ? raws : []) {
        let partial;
        try {
          partial = adapter.mapRaw(raw);
        } catch (err) {
          sLogger.debug('mapRaw fallo en un item', { error: err.message });
          continue;
        }
        const item = normalizeItem(partial, {
          source: partial.source || sourceCfg.type,
          sourceType: sourceCfg.type,
          language: brief.language,
          logger: sLogger,
        });
        if (item) {
          collected.push(item);
          kept += 1;
        }
      }
      sLogger.info('Fuente OK', { items: kept });
      perSource.push({ type: sourceCfg.type, status: 'ok', items: kept });
    } catch (err) {
      const e = err instanceof SourceError ? err : new SourceError(err.message, { cause: err });
      sLogger.warn('Fuente fallo (continuando)', { error: e.message });
      perSource.push({ type: sourceCfg.type, status: 'error', items: 0, error: e.message });
    }
  }

  return { collected, perSource };
}

/** Corre los agentes pluggables; degrada con elegancia por agente. */
async function runAgents({ brief, items, runId, ctx, settings, requestedAgents, logger, previousBriefDate }) {
  const manifests = ctx.registry.enabledFor(brief.id, requestedAgents);
  if (manifests.length === 0) {
    logger.info('Sin agentes habilitados para el brief', { topic: brief.id });
    return [];
  }
  const sanitizedItems = items.map(stripRaw);
  const input = connector.buildAgentInput({
    brief,
    items: sanitizedItems,
    runId,
    context: { previousBriefDate, timezone: settings.schedule.timezone },
  });

  const outputs = [];
  for (const manifest of manifests) {
    const aLogger = logger.child({ agentId: manifest.agent.id });
    try {
      const out = await connector.runAgent({
        manifest,
        input,
        ctx: { logger: aLogger, toolRoot: settings.resolved.toolRoot, http: ctx.http },
      });
      aLogger.info('Agente OK', { durationMs: out.durationMs });
      outputs.push(out);
    } catch (err) {
      aLogger.warn('Agente fallo: seccion marcada no disponible', { error: err.message });
      outputs.push({
        agentId: manifest.agent.id,
        displayName: manifest.agent.displayName,
        unavailable: true,
        error: err.message,
      });
    }
  }
  return outputs;
}

/**
 * Ejecuta un brief completo.
 * @param {string} topicId
 * @param {object} [opts] { dryRun, noAgents, requestedAgents, settings, logger }
 * @returns {Promise<object>} resumen del run
 */
async function runTopic(topicId, opts = {}) {
  const logger = (opts.logger || baseLogger).child({ topic: topicId });
  const settings = opts.settings || loadSettings();
  const brief = loadBriefById(topicId);
  const ctx = buildContext(settings, logger);

  if (!brief.enabled && !opts.force) {
    logger.warn('Brief deshabilitado, se omite (usa force para correr igual)');
    return { topic: topicId, skipped: 'disabled' };
  }

  const tz = brief.schedule.timezone || settings.schedule.timezone;
  const date = today(tz);
  const runId = `${new Date().toISOString()}#${topicId}`;
  const previousBriefDate = findPreviousBriefDate(ctx.paths, topicId, date);
  logger.info('Run iniciado', { date, dryRun: !!opts.dryRun });

  // 1. Fetch + normalize
  const { collected, perSource } = await collectItems(brief, ctx, logger);

  // 2. Dedup (intra + inter run con indice persistente)
  const dedupIndexFile = ctx.paths.dedupIndexFile();
  const index = opts.dryRun ? {} : store.readJson(dedupIndexFile, {});
  const dd = dedupe(collected, {
    strategy: brief.dedup.strategy,
    window: brief.dedup.window,
    index,
  });

  // 3. Orden por fecha desc + cap
  let items = dd.kept
    .sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0))
    .slice(0, brief.query.maxItems);

  logger.info('Items tras dedup', { ...dd.stats, final: items.length });

  // 4. Persistir items + indice
  if (!opts.dryRun) {
    if (brief.output.json) store.writeJsonAtomic(ctx.paths.itemsFile(topicId, date), items);
    store.writeJsonAtomic(dedupIndexFile, dd.index);
  }

  // 5. Agentes
  const agentOutputs =
    opts.noAgents ? [] : await runAgents({
      brief,
      items,
      runId,
      ctx,
      settings,
      requestedAgents: opts.requestedAgents,
      logger,
      previousBriefDate,
    });

  // 6. Render markdown (items sin raw)
  const renderItems = items.map(stripRaw);
  const markdown = renderBrief({
    brief,
    items: renderItems,
    agentOutputs,
    date,
    timezone: tz,
  });

  let briefPath = null;
  if (!opts.dryRun && brief.output.markdown) {
    briefPath = ctx.paths.briefFile(topicId, date);
    store.writeFileAtomic(briefPath, markdown);
    if (brief.output.json) {
      store.writeJsonAtomic(ctx.paths.analysisFile(topicId, date), {
        runId,
        date,
        agentOutputs,
      });
    }
  }

  // 7. Notificar (Telegram)
  let notified = false;
  const telegramOn = brief.notify.telegram && settings.notify.telegram.enabled;
  if (!opts.dryRun && telegramOn && telegram.isConfigured()) {
    const briefRelPath = briefPath
      ? path.relative(settings.resolved.repoRoot, briefPath)
      : null;
    const text = telegram.formatMessage({
      brief,
      items: renderItems,
      agentOutputs,
      date,
      briefRelPath,
    });
    try {
      const r = await telegram.send({ http: ctx.http, text, logger });
      notified = r.sent;
    } catch (err) {
      logger.warn('Notificacion Telegram fallo', { error: err.message });
    }
  }

  const summary = {
    topic: topicId,
    date,
    runId,
    counts: {
      fetched: collected.length,
      kept: items.length,
      removedDup: dd.stats.removed,
    },
    sources: perSource,
    agents: agentOutputs.map((o) => ({
      agentId: o.agentId,
      ok: !o.unavailable,
      error: o.error || null,
    })),
    briefPath,
    notified,
    dryRun: !!opts.dryRun,
    markdown: opts.dryRun ? markdown : undefined,
  };

  // 8. Run history
  if (!opts.dryRun) {
    store.appendJsonl(ctx.paths.runHistoryFile(), {
      ts: new Date().toISOString(),
      topic: topicId,
      date,
      counts: summary.counts,
      sources: perSource,
      agents: summary.agents,
      notified,
    });
  }

  logger.info('Run completado', { kept: items.length, notified });
  return summary;
}

/** Ejecuta todos los briefs habilitados (o los listados). */
async function runAll(opts = {}) {
  const settings = opts.settings || loadSettings();
  const briefs = loadAllBriefs().filter((b) => b.enabled || opts.force);
  const results = [];
  for (const b of briefs) {
    try {
      results.push(await runTopic(b.id, { ...opts, settings }));
    } catch (err) {
      (opts.logger || baseLogger).error('Run de brief fallo', { topic: b.id, error: err.message });
      results.push({ topic: b.id, error: err.message });
    }
  }
  return results;
}

module.exports = { runTopic, runAll, buildContext };
