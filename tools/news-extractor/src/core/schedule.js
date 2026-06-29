'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { getToolRoot, loadAllBriefs } = require('./config-loader');
const store = require('../storage/store');

/**
 * Scheduling diario via launchd (nativo de macOS, sobrevive reinicios, catch-up).
 * Genera ~/Library/LaunchAgents/com.castlecapital.news-extractor.plist cuyo
 * ProgramArguments es ["<node>", "<abs>/bin/news.js", "run", "--all"] (args como
 * array; nunca shell). Los horarios se derivan de los schedule.cron de cada brief.
 */

const LABEL = 'com.castlecapital.news-extractor';

function plistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

/** Parsea "min hour dom mon dow" -> array de dicts StartCalendarInterval. */
function parseCron(cron) {
  if (typeof cron !== 'string') return [];
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return [];
  const [min, hour, , , dow] = parts;
  const minute = /^\d+$/.test(min) ? Number(min) : 0;
  const hr = /^\d+$/.test(hour) ? Number(hour) : 7;
  const base = { Minute: minute, Hour: hr };
  if (dow && dow !== '*') {
    const days = dow
      .split(',')
      .map((d) => Number(d))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 7);
    if (days.length) return days.map((wd) => ({ ...base, Weekday: wd === 7 ? 0 : wd }));
  }
  return [base];
}

/** Une los intervalos de todos los briefs habilitados (deduplicados). */
function collectIntervals(briefs) {
  const seen = new Set();
  const out = [];
  for (const b of briefs) {
    if (!b.enabled || !b.schedule || !b.schedule.cron) continue;
    for (const iv of parseCron(b.schedule.cron)) {
      const key = JSON.stringify(iv);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(iv);
      }
    }
  }
  // Default razonable si ningun brief define cron: 7:00 hora local.
  if (out.length === 0) out.push({ Minute: 0, Hour: 7 });
  return out;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function intervalXml(iv) {
  const inner = Object.entries(iv)
    .map(([k, v]) => `      <key>${k}</key>\n      <integer>${v}</integer>`)
    .join('\n');
  return `    <dict>\n${inner}\n    </dict>`;
}

function buildPlist({ nodePath, scriptPath, workingDir, intervals, outLog, errLog }) {
  const args = [nodePath, scriptPath, 'run', '--all']
    .map((a) => `    <string>${xmlEscape(a)}</string>`)
    .join('\n');
  const cal = intervals.map(intervalXml).join('\n');
  const docType =
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ' +
    '"https://www.apple.com/DTDs/PropertyList-1.0.dtd">';
  return `<?xml version="1.0" encoding="UTF-8"?>
${docType}
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(workingDir)}</string>
  <key>StartCalendarInterval</key>
  <array>
${cal}
  </array>
  <key>StandardOutPath</key>
  <string>${xmlEscape(outLog)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(errLog)}</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

function launchctl(args) {
  const r = spawnSync('launchctl', args, { shell: false, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/** Instala (o reinstala) el LaunchAgent. */
function install(settings) {
  const toolRoot = getToolRoot();
  const scriptPath = path.join(toolRoot, 'bin', 'news.js');
  const runsDir = path.join(settings.resolved.outputDir, 'runs');
  store.ensureDir(runsDir);
  store.ensureDir(path.dirname(plistPath()));

  const intervals = collectIntervals(loadAllBriefs());
  const xml = buildPlist({
    nodePath: process.execPath,
    scriptPath,
    workingDir: toolRoot,
    intervals,
    outLog: path.join(runsDir, 'launchd.out.log'),
    errLog: path.join(runsDir, 'launchd.err.log'),
  });

  const file = plistPath();
  // Si ya estaba cargado, descargar antes de reemplazar.
  if (fs.existsSync(file)) launchctl(['unload', file]);
  store.writeFileAtomic(file, xml);
  const res = launchctl(['load', '-w', file]);
  return { file, intervals, loaded: res.code === 0, detail: res.stderr.trim() || res.stdout.trim() };
}

function uninstall() {
  const file = plistPath();
  if (!fs.existsSync(file)) return { file, removed: false, reason: 'no instalado' };
  launchctl(['unload', file]);
  fs.unlinkSync(file);
  return { file, removed: true };
}

function status() {
  const file = plistPath();
  const installed = fs.existsSync(file);
  const list = launchctl(['list']);
  const loaded = list.stdout.split('\n').some((l) => l.includes(LABEL));
  return { label: LABEL, file, installed, loaded };
}

module.exports = { install, uninstall, status, plistPath, parseCron, collectIntervals, LABEL };
