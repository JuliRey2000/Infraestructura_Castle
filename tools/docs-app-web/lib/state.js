// lib/state.js — Modelo de datos maestro del generador de documentos Castle Capital.
// Una sola fuente de verdad (`data`) alimenta los 4 documentos.
// Script clásico (sin ES modules) para funcionar con doble-clic vía file://.
(function () {
  'use strict';
  const CC = (window.CC = window.CC || {});

  // Orden y agrupación de campos (refleja el formulario maestro del shell).
  // `docs` indica en qué documentos aparece cada campo. El modo "Solo este
  // documento" del formulario usa esto para mostrar únicamente lo relevante.
  const ALL_DOCS = ['contrato', 'entrada', 'conversion', 'carta'];
  const FIELD_GROUPS = [
    {
      title: 'Identificación',
      fields: [
        { key: 'fecha', label: 'Fecha de la operación', type: 'date', docs: ALL_DOCS },
        { key: 'hora', label: 'Hora (GMT-5)', type: 'text', placeholder: '14:32 (GMT-5)', docs: ['entrada', 'conversion'] },
        { key: 'ciudadFirma', label: 'Ciudad de firma', type: 'text', placeholder: 'Armenia, Quindío', docs: ['contrato'] },
        { key: 'refContrato', label: 'Ref. contrato', type: 'text', placeholder: 'CCI-MND-2026-001', docs: ['contrato'] },
        { key: 'refEntrada', label: 'Ref. entrada de fondos', type: 'text', placeholder: 'CCI-EF-0001', docs: ['entrada'] },
        { key: 'refConversion', label: 'Ref. conversión', type: 'text', placeholder: 'CCI-CV-0001', docs: ['conversion'] },
      ],
    },
    {
      title: 'Cliente · Mandante',
      fields: [
        { key: 'nombre', label: 'Nombre completo', type: 'text', placeholder: 'Nombre y apellidos', docs: ALL_DOCS },
        { key: 'genero', label: 'Redacción de la carta', type: 'select', options: [['m', 'Hombre'], ['f', 'Mujer']], docs: ['carta'] },
        { key: 'cc', label: 'Cédula (C.C. N.°)', type: 'text', placeholder: '1.234.567.890', docs: ['contrato'] },
        { key: 'ciudad', label: 'Domicilio (ciudad)', type: 'text', placeholder: 'Ciudad', docs: ['contrato'] },
        { key: 'correo', label: 'Correo electrónico', type: 'email', placeholder: 'cliente@correo.com', docs: ['contrato'] },
        { key: 'tel', label: 'Teléfono / Celular', type: 'tel', placeholder: '320 000 0000', docs: ['contrato'] },
        { key: 'wallet', label: 'Wallet del cliente (0x…)', type: 'text', placeholder: '0x1234…abcd', docs: ['conversion'] },
      ],
    },
    {
      title: 'Mandatario · Gestor (Castle Capital)',
      fields: [
        { key: 'razon', label: 'Razón social', type: 'text', placeholder: 'Castle Capital Investments', docs: ['contrato'] },
        { key: 'nit', label: 'NIT', type: 'text', placeholder: '1.002.957.808-1', docs: ['contrato'] },
        { key: 'rep', label: 'Representante legal', type: 'text', placeholder: 'Julián Esteban Castillo Marulanda', docs: ['contrato'] },
        { key: 'repcc', label: 'C.C. representante', type: 'text', placeholder: '1.002.957.808', docs: ['contrato'] },
      ],
    },
    {
      title: 'Activos gestionados (contrato)',
      fields: [
        { key: 'activosIniciales', label: 'Activos iniciales (cripto + montos)', type: 'textarea', placeholder: 'Ej: 10.000 USDC + 0,5 ETH', docs: ['contrato'] },
        { key: 'redContrato', label: 'Red / blockchain (contrato)', type: 'text', placeholder: 'Arbitrum One', docs: ['contrato'] },
      ],
    },
    {
      title: 'Operación de conversión',
      fields: [
        { key: 'monedaEfectivo', label: 'Moneda del efectivo recibido', type: 'select', options: [['COP', 'Pesos (COP)'], ['USD', 'Dólares (USD)']], docs: ['entrada', 'conversion'] },
        { key: 'efectivo', label: 'Efectivo recibido (monto)', type: 'text', placeholder: '2.000', format: 'amount', docs: ['entrada', 'conversion'] },
        { key: 'tasa', label: 'Tasa de referencia (solo si es COP)', type: 'text', placeholder: '1 USD = $ 4.050 COP', docs: ['entrada', 'conversion'] },
        { key: 'usd', label: 'Equivalente en USD (solo si es COP)', type: 'text', placeholder: '2.000,00', format: 'amount', docs: ['entrada', 'conversion'] },
        { key: 'usdc', label: 'Cripto a entregar (monto)', type: 'text', placeholder: '2.000,00', format: 'amount', docs: ['entrada', 'conversion'] },
        { key: 'activoNombre', label: 'Activo digital', type: 'text', placeholder: 'USD Coin', docs: ['conversion'] },
        { key: 'red', label: 'Red / blockchain', type: 'text', placeholder: 'Arbitrum One', docs: ['entrada', 'conversion'] },
        { key: 'plazo', label: 'Plazo de conversión', type: 'text', placeholder: '3 días hábiles', docs: ['entrada'] },
      ],
    },
    {
      title: 'Verificación on-chain (comprobante de conversión)',
      fields: [
        { key: 'hash', label: 'Hash de transacción', type: 'text', placeholder: '0x… (64 caracteres)', docs: ['conversion'] },
      ],
    },
  ];

  // Valores por defecto. Mandatario precargado con datos de Castle Capital / Julián.
  const DEFAULTS = {
    refContrato: 'CCI-MND-2026-001',
    refEntrada: 'CCI-EF-0001',
    refConversion: 'CCI-CV-0001',
    ciudadFirma: 'Armenia, Quindío',
    fecha: '',
    hora: '',
    nombre: '',
    genero: 'm',
    cc: '',
    ciudad: '',
    correo: '',
    tel: '',
    wallet: '',
    razon: 'Castle Capital Investments',
    nit: '1.002.957.808-1',
    rep: 'Julián Esteban Castillo Marulanda',
    repcc: '1.002.957.808',
    activosIniciales: '',
    redContrato: 'Arbitrum One',
    efectivo: '',
    monedaEfectivo: 'COP',
    tasa: '',
    usd: '',
    usdc: '',
    activoNombre: 'USD Coin',
    red: 'Arbitrum One',
    plazo: '3 días hábiles',
    spread: '',
    hash: '',
    bloque: '',
    dirOrigen: '',
    dirDestino: '',
    explorer: 'arbiscan.io',
    saldoConfirmado: '',
    protocolo: 'Uniswap V3',
  };

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // Escapa HTML para evitar que el input del cliente rompa el render o inyecte markup.
  function esc(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // "2026-06-07" → "7 de junio de 2026". Acepta ya-formateado si no es ISO.
  function fmtDate(iso) {
    if (!iso) return '';
    const p = String(iso).split('-');
    if (p.length !== 3) return iso;
    const d = parseInt(p[2], 10);
    const m = parseInt(p[1], 10) - 1;
    if (isNaN(d) || m < 0 || m > 11) return iso;
    return `${d} de ${MESES[m]} de ${p[0]}`;
  }

  // "2026-06-07" → "7 junio 2026" (cabecera de la carta).
  function fmtDateShort(iso) {
    if (!iso) return '';
    const p = String(iso).split('-');
    if (p.length !== 3) return iso;
    const d = parseInt(p[2], 10);
    const m = parseInt(p[1], 10) - 1;
    if (isNaN(d) || m < 0 || m > 11) return iso;
    return `${d} ${MESES[m]} ${p[0]}`;
  }

  // Enmascara wallets/direcciones a 0x1234…abcd (estándar PII Castle Capital).
  function maskWallet(addr) {
    if (!addr) return '';
    const s = String(addr).trim();
    if (s.length <= 11) return s;
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
  }

  // Campo del contrato: span lleno o placeholder en cursiva (replica el prototipo).
  function f(value, placeholder) {
    const v = value == null ? '' : String(value).trim();
    if (!v) return `<span class="f empty">${esc(placeholder || '[___]')}</span>`;
    return `<span class="f">${esc(v)}</span>`;
  }

  // Cliente nuevo con id único y datos por defecto.
  function newClient() {
    const id = (self.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const now = Date.now();
    return { id, createdAt: now, updatedAt: now, data: Object.assign({}, DEFAULTS) };
  }

  // Etiqueta para mostrar en el roster.
  function clientLabel(client) {
    const n = client && client.data && client.data.nombre && client.data.nombre.trim();
    return n || 'Cliente sin nombre';
  }

  // Fecha de hoy en ISO local (YYYY-MM-DD), sin desfase de zona horaria.
  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  // Formatea un monto al estilo colombiano: miles con punto, decimales con coma.
  // Idempotente: re-formatear "8.100.000" devuelve "8.100.000".
  function formatAmount(raw) {
    if (raw == null) return '';
    const s = String(raw).trim();
    if (!s) return '';
    let intPart;
    let dec = '';
    if (s.indexOf(',') >= 0) {
      const i = s.lastIndexOf(',');
      intPart = s.slice(0, i);
      dec = s.slice(i + 1).replace(/\D/g, '').slice(0, 2);
    } else {
      // un único punto con 1-2 dígitos finales se interpreta como decimal
      const m = s.match(/^(\d+)\.(\d{1,2})$/);
      if (m) { intPart = m[1]; dec = m[2]; } else { intPart = s; }
    }
    intPart = intPart.replace(/\D/g, '');
    if (!intPart && !dec) return '';
    if (!intPart) intPart = '0';
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dec ? `${intPart},${dec}` : intPart;
  }

  // Referencias consecutivas para un cliente nuevo, según el roster existente.
  const REF_BUILDERS = {
    refContrato: (n) => `CCI-MND-${new Date().getFullYear()}-${String(n).padStart(3, '0')}`,
    refEntrada: (n) => `CCI-EF-${String(n).padStart(4, '0')}`,
    refConversion: (n) => `CCI-CV-${String(n).padStart(4, '0')}`,
  };
  function trailingNum(s) {
    const m = String(s == null ? '' : s).match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function nextReferences(clients) {
    const out = {};
    Object.keys(REF_BUILDERS).forEach((key) => {
      let max = 0;
      (clients || []).forEach((c) => {
        const n = trailingNum(c && c.data && c.data[key]);
        if (n > max) max = n;
      });
      out[key] = REF_BUILDERS[key](max + 1);
    });
    return out;
  }

  CC.state = {
    FIELD_GROUPS, DEFAULTS,
    esc, fmtDate, fmtDateShort, maskWallet, f, newClient, clientLabel,
    todayISO, formatAmount, nextReferences,
  };
})();
