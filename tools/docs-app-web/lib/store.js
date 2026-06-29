// lib/store.js — Roster de clientes en localStorage (solo máquina local).
// La PII del cliente nunca sale del navegador. Se ofrece export/import JSON
// para respaldo manual. Script clásico (sin ES modules) para file://.
(function () {
  'use strict';
  const CC = (window.CC = window.CC || {});
  const { newClient, DEFAULTS, nextReferences, todayISO } = CC.state;

  const KEY = 'castle_docs_clients_v1';
  const ACTIVE = 'castle_docs_active_id';

  function loadAll() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (error) {
      console.error('No se pudo leer el roster de clientes', { error });
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (error) {
      console.error('No se pudo guardar el roster de clientes', { error });
      throw new Error(`No se pudo guardar: ${error instanceof Error ? error.message : 'desconocido'}`);
    }
  }

  function getActiveId() {
    return localStorage.getItem(ACTIVE) || null;
  }

  function setActiveId(id) {
    if (id) localStorage.setItem(ACTIVE, id);
    else localStorage.removeItem(ACTIVE);
  }

  // Inserta o actualiza un cliente (por id), refrescando updatedAt.
  function upsert(client) {
    const list = loadAll();
    const i = list.findIndex((c) => c.id === client.id);
    client.updatedAt = Date.now();
    if (i >= 0) list[i] = client;
    else list.push(client);
    saveAll(list);
    return list;
  }

  function remove(id) {
    const list = loadAll().filter((c) => c.id !== id);
    saveAll(list);
    if (getActiveId() === id) setActiveId(list[0] ? list[0].id : null);
    return list;
  }

  // Duplica un cliente: copia datos, nuevo id, sufijo "(copia)" en el nombre.
  // Asigna referencias consecutivas nuevas para evitar colisión con el original.
  function duplicate(id) {
    const src = loadAll().find((c) => c.id === id);
    const copy = newClient();
    if (src) {
      copy.data = Object.assign({}, src.data);
      copy.data.nombre = (src.data.nombre || 'Cliente') + ' (copia)';
    }
    Object.assign(copy.data, nextReferences(loadAll()));
    upsert(copy);
    return copy;
  }

  // Crea, persiste y activa un cliente nuevo: referencias consecutivas + fecha de hoy.
  function create() {
    const client = newClient();
    Object.assign(client.data, nextReferences(loadAll()));
    client.data.fecha = todayISO();
    upsert(client);
    setActiveId(client.id);
    return client;
  }

  function getById(id) {
    return loadAll().find((c) => c.id === id) || null;
  }

  // Respaldo: serializa todo el roster a JSON.
  function exportJSON() {
    return JSON.stringify({ version: 1, exportedAt: Date.now(), clients: loadAll() }, null, 2);
  }

  // Importa un respaldo. Reemplaza el roster completo. Devuelve el conteo importado.
  function importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error('Archivo de respaldo inválido (no es JSON).');
    }
    const clients = Array.isArray(parsed) ? parsed : parsed.clients;
    if (!Array.isArray(clients)) throw new Error('El respaldo no contiene una lista de clientes.');
    const normalized = clients.map((c) => ({
      id: c.id || newClient().id,
      createdAt: c.createdAt || Date.now(),
      updatedAt: c.updatedAt || Date.now(),
      data: Object.assign({}, DEFAULTS, c.data || {}),
    }));
    saveAll(normalized);
    setActiveId(normalized[0] ? normalized[0].id : null);
    return normalized.length;
  }

  CC.store = {
    loadAll, saveAll, getActiveId, setActiveId,
    upsert, remove, duplicate, create, getById, exportJSON, importJSON,
  };
})();
