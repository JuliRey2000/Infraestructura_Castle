'use strict';

/* news-extractor Web UI — vanilla, sin build. Delega todo a /api (= core). */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

let toastTimer;
function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  return s;
}

/** Render markdown simple (encabezados, listas, citas, hr, parrafos). */
function renderMarkdown(md) {
  const lines = String(md).split('\n');
  const html = [];
  let inList = false;
  const closeList = () => { if (inList) { html.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^#\s+/.test(line)) { closeList(); html.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else if (/^##\s+/.test(line)) { closeList(); html.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (/^###\s+/.test(line)) { closeList(); html.push(`<h3>${inline(line.slice(4))}</h3>`); }
    else if (/^>\s?/.test(line)) { closeList(); html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); }
    else if (/^---+$/.test(line)) { closeList(); html.push('<hr />'); }
    else if (/^\s*[-*]\s+/.test(line)) { if (!inList) { html.push('<ul>'); inList = true; } html.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`); }
    else if (/^\s*\d+\.\s+/.test(line)) { if (!inList) { html.push('<ul>'); inList = true; } html.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`); }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); html.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return html.join('\n');
}

// --- Tabs ---
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
  $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === btn.dataset.tab));
  if (btn.dataset.tab === 'briefs') loadBriefTopics();
  if (btn.dataset.tab === 'agents') loadAgents();
  if (btn.dataset.tab === 'settings') loadSettings();
});

// --- Dashboard ---
async function loadTopics() {
  const list = $('#topics-list');
  try {
    const { topics } = await api('GET', '/api/topics');
    if (!topics.length) { list.innerHTML = '<p class="hint">No hay temas. Crea uno con <code>news add-topic</code>.</p>'; return; }
    list.innerHTML = '';
    for (const t of topics) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-row">
          <div>
            <h3><span class="dot ${t.enabled ? 'on' : 'off'}"></span>${escapeHtml(t.displayName)}</h3>
            <div class="meta">${escapeHtml(t.sources.join(', '))} · cron ${escapeHtml(t.cron || '—')}</div>
            <div style="margin-top:8px">${(t.tickers || []).map((x) => `<span class="tag-chip">${escapeHtml(x)}</span>`).join('')}</div>
          </div>
          <button class="btn" data-run="${escapeHtml(t.id)}">Run now</button>
        </div>`;
      list.appendChild(card);
    }
  } catch (err) {
    list.innerHTML = `<p class="warn">Error: ${escapeHtml(err.message)}</p>`;
  }
}

$('#topics-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-run]');
  if (!btn) return;
  const id = btn.dataset.run;
  btn.disabled = true;
  const label = btn.textContent;
  btn.innerHTML = '<span class="spinner"></span>Corriendo…';
  toast(`Ejecutando ${id}…`);
  try {
    const r = await api('POST', `/api/topics/${id}/run`, {});
    toast(`✓ ${id}: ${r.counts.kept} noticias · Telegram ${r.notified ? 'enviado' : 'no'}`);
  } catch (err) {
    toast(`✗ ${id}: ${err.message}`, 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

// --- Briefs ---
async function loadBriefTopics() {
  const sel = $('#brief-topic');
  if (sel.dataset.loaded) return;
  const { topics } = await api('GET', '/api/topics');
  sel.innerHTML = topics.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.displayName)}</option>`).join('');
  sel.dataset.loaded = '1';
  sel.addEventListener('change', () => loadBrief(sel.value));
  $('#brief-date').addEventListener('change', () => loadBrief(sel.value, $('#brief-date').value));
  if (topics.length) loadBrief(topics[0].id);
}

async function loadBrief(topic, date) {
  const content = $('#brief-content');
  content.innerHTML = '<p class="hint">Cargando…</p>';
  try {
    const b = await api('GET', `/api/briefs/${topic}${date ? `/${date}` : ''}`);
    const dateSel = $('#brief-date');
    dateSel.innerHTML = b.dates.slice().reverse().map((d) => `<option value="${d}"${d === b.date ? ' selected' : ''}>${d}</option>`).join('');
    content.innerHTML = renderMarkdown(b.markdown);
  } catch (err) {
    content.innerHTML = `<p class="hint">Sin brief para este tema todavía. Corre el tema desde el Dashboard.</p>`;
  }
}

// --- Agents ---
async function loadAgents() {
  const list = $('#agents-list');
  list.innerHTML = 'Cargando…';
  try {
    const { agents } = await api('GET', '/api/agents');
    if (!agents.length) { list.innerHTML = '<p class="hint">Sin agentes registrados.</p>'; return; }
    list.innerHTML = '';
    for (const a of agents) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-row">
          <div>
            <h3><span class="dot ${a.enabled ? 'on' : 'off'}"></span>${escapeHtml(a.displayName)}</h3>
            <div class="meta">id: ${escapeHtml(a.id)} · transport: ${escapeHtml(a.transport)} · v${escapeHtml(a.version)}</div>
            <div class="meta">aplica: ${escapeHtml(a.appliesTo.join(', ') || 'todos')}</div>
          </div>
          <button class="btn ${a.enabled ? 'ghost' : ''} small" data-agent="${escapeHtml(a.id)}" data-enabled="${a.enabled}">
            ${a.enabled ? 'Deshabilitar' : 'Habilitar'}
          </button>
        </div>`;
      list.appendChild(card);
    }
  } catch (err) {
    list.innerHTML = `<p class="warn">Error: ${escapeHtml(err.message)}</p>`;
  }
}

$('#agents-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-agent]');
  if (!btn) return;
  const id = btn.dataset.agent;
  const enable = btn.dataset.enabled !== 'true';
  try {
    await api('POST', `/api/agents/${id}/${enable ? 'enable' : 'disable'}`);
    toast(`${id}: ${enable ? 'habilitado' : 'deshabilitado'}`);
    loadAgents();
  } catch (err) {
    toast(`✗ ${err.message}`, 4000);
  }
});

// --- Settings ---
async function loadSettings() {
  const el = $('#settings-content');
  el.innerHTML = 'Cargando…';
  try {
    const s = await api('GET', '/api/settings');
    const yn = (b) => (b ? '<span class="ok">OK</span>' : '<span class="warn">ausente</span>');
    const sourceRows = s.sources.map((src) => `<div class="kv"><span class="k">${src.type}</span><span>${src.requiresKey ? yn(src.keyPresent) : 'sin clave'}</span></div>`).join('');
    el.innerHTML = `
      <div class="card">
        <h3>General</h3>
        <div class="kv"><span class="k">Timezone</span><span>${escapeHtml(s.timezone)}</span></div>
        <div class="kv"><span class="k">Modelo IA</span><span>${escapeHtml(s.ai.default_model)} ${yn(s.ai.keyPresent)}</span></div>
        <div class="kv"><span class="k">Telegram</span><span>${s.telegram.configured ? '<span class="ok">configurado</span>' : '<span class="warn">no configurado</span>'}</span></div>
      </div>
      <div class="card"><h3>Claves de fuentes</h3>${sourceRows}</div>
      <div class="card">
        <h3>Scheduling (launchd)</h3>
        <div class="kv"><span class="k">Instalado</span><span>${s.schedule.installed ? '<span class="ok">sí</span>' : 'no'}</span></div>
        <div class="kv"><span class="k">Cargado</span><span>${s.schedule.loaded ? '<span class="ok">sí</span>' : 'no'}</span></div>
      </div>`;
  } catch (err) {
    el.innerHTML = `<p class="warn">Error: ${escapeHtml(err.message)}</p>`;
  }
}

// init
loadTopics();
