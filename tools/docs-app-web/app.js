// app.js — Shell del generador de documentos Castle Capital.
// Formulario maestro + roster de clientes → preview en iframe aislado por documento.
// Script clásico (sin ES modules) para funcionar con doble-clic vía file://.
(function () {
  'use strict';
  const { state, store, docs } = window.CC;
  const { FIELD_GROUPS, clientLabel, formatAmount } = state;

  // Catálogo de documentos: orden, etiqueta, renderer y nombre de archivo sugerido.
  const DOC_LIST = [
    { id: 'contrato', label: 'Contrato de Mandato', file: 'Contrato de Mandato' },
    { id: 'entrada', label: 'Entrada de fondos', file: 'Comprobante entrada de fondos' },
    { id: 'conversion', label: 'Comprobante de conversión', file: 'Comprobante de conversion' },
    { id: 'carta', label: 'Carta de bienvenida', file: 'Carta de bienvenida' },
  ];

  // Campos mínimos por documento (aviso suave antes de imprimir).
  const REQUIRED = {
    contrato: ['nombre', 'cc', 'fecha'],
    entrada: ['nombre', 'fecha', 'efectivo'],
    conversion: ['nombre', 'fecha', 'efectivo', 'wallet', 'hash'],
    carta: ['nombre'],
  };

  // Lookup key → etiqueta legible (desde FIELD_GROUPS).
  const LABELS = {};
  FIELD_GROUPS.forEach((g) => g.fields.forEach((fld) => { LABELS[fld.key] = fld.label; }));
  function labelOf(key) { return LABELS[key] || key; }

  // URL del directorio de la app, para el <base href> de cada iframe.
  const BASE_HREF = new URL('.', location.href).href;

  // Estado de UI
  let active = null;          // cliente activo (en memoria)
  let currentDoc = 'contrato';
  let formMode = 'doc';       // 'doc' = solo campos del documento activo · 'all' = todos
  let saveTimer = null;
  let previewTimer = null;

  // Elementos del shell
  const els = {};

  function $(id) { return document.getElementById(id); }

  function sanitize(s) {
    return (s || 'Cliente')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Cliente';
  }

  // ── Roster ────────────────────────────────────────────────────────────
  function ensureActive() {
    let list = store.loadAll();
    if (list.length === 0) {
      active = store.create();
      list = store.loadAll();
      return;
    }
    const id = store.getActiveId();
    active = store.getById(id) || list[0];
    store.setActiveId(active.id);
  }

  function renderRoster() {
    const list = store.loadAll();
    const sel = els.roster;
    sel.innerHTML = '';
    list.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = clientLabel(c);
      if (active && c.id === active.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── Formulario maestro ───────────────────────────────────────────────
  // Campos visibles según el modo: 'all' = todos; 'doc' = solo los del doc activo.
  function visibleFields(group) {
    if (formMode === 'all') return group.fields;
    return group.fields.filter((fld) => !fld.docs || fld.docs.indexOf(currentDoc) >= 0);
  }

  function buildForm() {
    const form = els.form;
    form.innerHTML = '';
    FIELD_GROUPS.forEach((group) => {
      const fields = visibleFields(group);
      if (fields.length === 0) return;
      const g = document.createElement('div');
      g.className = 'group';
      const title = document.createElement('p');
      title.className = 'group-title';
      title.textContent = group.title;
      g.appendChild(title);

      fields.forEach((field) => {
        const row = document.createElement('div');
        row.className = 'field-row';
        const lab = document.createElement('label');
        lab.className = 'lab';
        lab.textContent = field.label;
        lab.setAttribute('for', 'i_' + field.key);
        row.appendChild(lab);

        let input;
        if (field.type === 'textarea') {
          input = document.createElement('textarea');
        } else if (field.type === 'select') {
          input = document.createElement('select');
          field.options.forEach(([val, txt]) => {
            const o = document.createElement('option');
            o.value = val;
            o.textContent = txt;
            input.appendChild(o);
          });
        } else {
          input = document.createElement('input');
          input.type = field.type || 'text';
        }
        input.className = 'inp';
        input.id = 'i_' + field.key;
        input.dataset.key = field.key;
        if (field.format) input.dataset.format = field.format;
        if (field.placeholder) input.placeholder = field.placeholder;
        input.addEventListener('input', onFieldInput);
        input.addEventListener('change', onFieldInput);
        row.appendChild(input);
        g.appendChild(row);
      });
      form.appendChild(g);
    });
  }

  // Reconstruye el formulario (estructura) y vuelve a cargar los valores.
  function rebuildForm() {
    buildForm();
    fillForm();
  }

  // Vuelca los datos del cliente activo en los inputs.
  function fillForm() {
    if (!active) return;
    els.form.querySelectorAll('[data-key]').forEach((inp) => {
      const key = inp.dataset.key;
      inp.value = active.data[key] != null ? active.data[key] : '';
    });
  }

  function onFieldInput(e) {
    if (!active) return;
    const key = e.target.dataset.key;
    let value = e.target.value;
    // Al salir del campo (change), normaliza montos al formato colombiano.
    if (e.type === 'change' && e.target.dataset.format === 'amount') {
      value = formatAmount(value);
      e.target.value = value;
    }
    active.data[key] = value;
    // refresca etiqueta del roster en vivo si cambió el nombre
    if (key === 'nombre') {
      const opt = els.roster.querySelector('option[value="' + active.id + '"]');
      if (opt) opt.textContent = clientLabel(active);
    }
    scheduleSave();
    schedulePreview();
  }

  // Re-render del iframe con debounce para no recargarlo en cada tecla.
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 180);
  }

  function scheduleSave() {
    setSaved('Guardando…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        store.upsert(active);
        setSaved('Guardado automáticamente');
      } catch (error) {
        setSaved('Error al guardar');
      }
    }, 400);
  }

  function setSaved(text) {
    if (els.saved) els.saved.textContent = text;
  }

  // ── Tabs + preview ───────────────────────────────────────────────────
  function buildTabs() {
    const nav = els.tabs;
    nav.innerHTML = '';
    DOC_LIST.forEach((doc) => {
      const b = document.createElement('button');
      b.className = 'tab' + (doc.id === currentDoc ? ' active' : '');
      b.textContent = doc.label;
      b.dataset.doc = doc.id;
      b.addEventListener('click', () => {
        currentDoc = doc.id;
        nav.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.doc === currentDoc));
        if (formMode === 'doc') rebuildForm();
        renderPreview();
      });
      nav.appendChild(b);
    });
  }

  function renderPreview() {
    if (!active) return;
    const doc = docs[currentDoc];
    if (!doc) return;
    els.frame.srcdoc = doc.render(active.data, BASE_HREF);
  }

  function printCurrent() {
    const win = els.frame.contentWindow;
    if (!win) return;
    // Aviso suave si faltan datos mínimos del documento.
    const req = REQUIRED[currentDoc] || [];
    const missing = req.filter((k) => !(active.data[k] && String(active.data[k]).trim()));
    if (missing.length) {
      const list = missing.map((k) => '·  ' + labelOf(k)).join('\n');
      if (!confirm(`Este documento tiene campos sin completar:\n\n${list}\n\n¿Imprimir / guardar PDF de todos modos?`)) return;
    }
    const docMeta = DOC_LIST.find((d) => d.id === currentDoc);
    const filename = `${docMeta.file} — ${sanitize(active.data.nombre)}`;
    const prevTitle = document.title;
    // Sugiere el nombre del PDF en el diálogo del navegador.
    document.title = filename;
    const restore = () => { document.title = prevTitle; };
    win.addEventListener('afterprint', restore, { once: true });
    win.focus();
    win.print();
    setTimeout(restore, 1500);
  }

  // ── Acciones de roster ───────────────────────────────────────────────
  function switchTo(id) {
    const c = store.getById(id);
    if (!c) return;
    active = c;
    store.setActiveId(id);
    fillForm();
    renderPreview();
    setSaved('Guardado automáticamente');
  }

  function newClient() {
    active = store.create();
    renderRoster();
    fillForm();
    renderPreview();
    setSaved('Cliente nuevo creado');
  }

  function duplicateClient() {
    if (!active) return;
    active = store.duplicate(active.id);
    store.setActiveId(active.id);
    renderRoster();
    fillForm();
    renderPreview();
    setSaved('Cliente duplicado');
  }

  function deleteClient() {
    if (!active) return;
    if (!confirm(`¿Borrar a "${clientLabel(active)}"? Esta acción no se puede deshacer.`)) return;
    store.remove(active.id);
    ensureActive();
    renderRoster();
    fillForm();
    renderPreview();
    setSaved('Cliente borrado');
  }

  function exportBackup() {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `castle-clientes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = store.importJSON(String(reader.result));
        ensureActive();
        renderRoster();
        fillForm();
        renderPreview();
        setSaved(`Importados ${n} cliente(s)`);
      } catch (error) {
        alert('No se pudo importar: ' + (error instanceof Error ? error.message : 'error'));
      }
    };
    reader.readAsText(file);
  }

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    els.roster = $('roster');
    els.form = $('form');
    els.tabs = $('tabs');
    els.frame = $('frame');
    els.saved = $('savedTxt');

    ensureActive();
    buildForm();
    buildTabs();
    renderRoster();
    fillForm();
    renderPreview();

    // Toggle modo de formulario (solo este documento / todos los campos)
    const modeDoc = $('modeDoc');
    const modeAll = $('modeAll');
    function setFormMode(mode) {
      formMode = mode;
      modeDoc.classList.toggle('active', mode === 'doc');
      modeAll.classList.toggle('active', mode === 'all');
      rebuildForm();
    }
    modeDoc.addEventListener('click', () => setFormMode('doc'));
    modeAll.addEventListener('click', () => setFormMode('all'));

    els.roster.addEventListener('change', (e) => switchTo(e.target.value));
    $('btnNew').addEventListener('click', newClient);
    $('btnDup').addEventListener('click', duplicateClient);
    $('btnDel').addEventListener('click', deleteClient);
    $('btnPrint').addEventListener('click', printCurrent);
    $('btnExport').addEventListener('click', exportBackup);
    $('fileImport').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
