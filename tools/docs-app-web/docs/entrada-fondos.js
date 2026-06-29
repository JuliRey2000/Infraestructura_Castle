// docs/entrada-fondos.js — Comprobante de entrada de fondos.
// Portado verbatim del prototipo (project/Comprobante de entrada de fondos.html),
// sustituyendo el objeto DATA hardcodeado por el estado maestro + escape HTML.

(function () {
  'use strict';
  const CC = (window.CC = window.CC || {});
  const { esc, fmtDate } = CC.state;

const ICON = {
  cash: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
  rate: '<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3M17 17H6l3 3"/><path d="M7 7v0M17 17v0"/></svg>',
  usd: '<svg viewBox="0 0 24 24"><path d="M12 2v20M17 5.5c0-1.7-2.2-3-5-3s-5 1.3-5 3 2.2 2.6 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3"/></svg>',
  asset: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.2 9.3c0-1 1.3-1.6 2.8-1.6s2.8.6 2.8 1.6-1.1 1.4-2.8 1.6c-1.7.2-2.8.7-2.8 1.7s1.3 1.7 2.8 1.7 2.8-.7 2.8-1.7"/></svg>',
  net: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M10.7 6.7 6.3 15.5M13.3 6.7l4.4 8.8M7.4 18h9.2"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

function sheet(d) {
  const isUSD = d.monedaEfectivo === 'USD';
  const cliente = esc(d.nombre) || 'Cliente / Titular';
  const efectivo = esc(d.efectivo) || '0';
  const moneda = esc(d.monedaEfectivo) || 'COP';
  const tasa = esc(d.tasa) || '—';
  const usd = esc(d.usd) || '0,00';
  // Si el efectivo ya es USD, el USDC a entregar es 1:1 por defecto (sin tasa COP).
  const usdcRaw = (d.usdc && String(d.usdc).trim()) ? d.usdc : (isUSD ? d.efectivo : '');
  const usdc = esc(usdcRaw) || '0,00';
  const red = esc(d.red) || '—';
  const plazo = esc(d.plazo) || '—';
  const ref = esc(d.refEntrada) || '—';
  const fecha = esc(fmtDate(d.fecha)) || '—';
  const hora = esc(d.hora) || '';

  // En USD no anteponemos símbolo (la moneda va como sufijo): "2.000 USD", no "USD 2.000 USD".
  const effDisp = (isUSD ? '' : '$ ') + efectivo;
  const arrow = '<div class="farrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>';
  const effCell = `<div class="fcell"><div class="k">Efectivo recibido</div><div class="v">${effDisp}<span class="cur">${moneda}</span></div><div class="note">Entregado en efectivo por el cliente</div></div>`;
  const usdCell = `<div class="fcell"><div class="k">Equivalente en USD</div><div class="v">$ ${usd}<span class="cur">USD</span></div><div class="note">Tasa de referencia · ${tasa}</div></div>`;
  const usdcCell = `<div class="fcell accent"><div class="k">A convertir en</div><div class="v">${usdc}<span class="cur">USDC</span></div><div class="pend"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> En proceso · ${plazo}</div></div>`;
  const flow = isUSD
    ? `<div class="flow flow-2">${effCell}${arrow}${usdcCell}</div>`
    : `<div class="flow flow-3">${effCell}${arrow}${usdCell}${arrow}${usdcCell}</div>`;
  const tasaRow = isUSD ? '' : `
        <div class="drow">
          <div class="dk">${ICON.rate} Tasa de referencia</div>
          <div class="dv mono">${tasa}</div>
        </div>`;
  // En USD se omite la fila "Monto recibido en USD" (sería redundante con el monto recibido).
  const usdRow = isUSD ? '' : `
        <div class="drow">
          <div class="dk">${ICON.usd} Monto recibido en USD</div>
          <div class="dv mono"><b>$ ${usd}</b> USD</div>
        </div>`;

  return `
  <div class="sheet light">
    <div class="watermark">
      <img class="emblem" src="assets/logo-line-ink.png" alt="">
      <div class="word">Castle Capital</div>
    </div>
    <div class="doc">

      <div class="head">
        <div class="mark">
          <img src="assets/logo-castle.png" alt="Castle Capital">
          <div>
            <div class="wm-name">Castle Capital</div>
            <div class="wm-tag">Diseño<b>·</b>Estructura<b>·</b>Legado</div>
          </div>
        </div>
        <div class="doctype">
          <div class="ey">Comprobante de entrada de fondos</div>
          <div class="prod"><i></i> Castle Crypto Income</div>
        </div>
      </div>
      <div class="rule"></div>

      <div class="titlerow">
        <div>
          <h1>Comprobante de <span class="gold">entrada de fondos</span></h1>
          <div class="sub">Recibo de los fondos entregados en efectivo, en proceso de conversión a USDC.</div>
        </div>
        <div class="refbox">
          <div class="lab">Referencia</div>
          <div class="ref">${ref}</div>
          <div class="date"><span class="lab2">Fecha de recepción</span>${fecha}<br>${hora}</div>
        </div>
      </div>

      <div class="constancia">
        Castle Capital deja constancia de la <strong>recepción en efectivo</strong> de los fondos detallados a continuación, entregados por el cliente para su conversión a activos digitales (USDC), a favor de:
      </div>
      <div class="client">
        <div>
          <div class="who-lab">Cliente / Titular</div>
          <div class="who">${cliente}</div>
        </div>
      </div>

      <div class="sec-eyebrow">Resumen de la recepción</div>
      ${flow}

      <div class="sec-eyebrow">Detalle de la operación</div>
      <div class="detail">
        <div class="drow">
          <div class="dk">${ICON.cash} Monto recibido</div>
          <div class="dv mono"><b>${effDisp}</b> ${moneda} · en efectivo</div>
        </div>
        ${tasaRow}
        ${usdRow}
        <div class="drow">
          <div class="dk">${ICON.asset} Activo a entregar</div>
          <div class="dv"><span class="badge asset"><span class="tok">$</span> USDC</span> ${usdc} USDC <span class="badge net">${red}</span></div>
        </div>
        <div class="drow">
          <div class="dk">${ICON.clock} Plazo de conversión</div>
          <div class="dv"><span class="badge plazo">${ICON.clock} ${plazo}</span> <span class="badge pending">En proceso</span></div>
        </div>
      </div>

      <div class="note-box accent">
        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.2-8.6"/><path d="m9 12 2 2 4-4M21 5l-2 2"/></svg>
        <div class="ot">
          <strong>Proceso de conversión.</strong> Recibido el efectivo, Castle Capital ejecuta la conversión del monto a <strong>USDC (USD Coin)</strong>, un activo digital estable referenciado <em>1:1</em> al dólar estadounidense, dentro de un plazo máximo de <span class="hl">${plazo}</span>. Cumplido el plazo, el cliente recibirá el <strong>Comprobante de conversión</strong> con el hash de la transacción verificable on-chain y el USDC depositado directamente en su wallet personal.
        </div>
      </div>

      <div class="note-box">
        <svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        <div class="ot">
          <strong>Propiedad y no custodia.</strong> Los activos resultantes de esta conversión son de <strong>exclusiva propiedad y control del cliente</strong> y se entregarán directamente a su wallet personal. Castle Capital <strong>no custodia, no retiene ni administra</strong> fondos de terceros: actúa <em>únicamente</em> como facilitador de la conversión. La responsabilidad sobre las claves privadas y los activos recae enteramente en el titular.
        </div>
      </div>

      <div class="signrow">
        <div class="signblock">
          <img class="sig" src="assets/firma-ink.png" alt="Firma de Julián Castillo">
          <div class="sigline">
            <div class="nm">Julián Esteban Castillo Marulanda</div>
            <div class="role">CEO · <b>Castle Capital</b></div>
          </div>
        </div>
        <div class="seal">
          <div class="outer"></div>
          <svg class="ring" viewBox="0 0 100 100">
            <defs><path id="cap-ef" d="M50,50 m-39,0 a39,39 0 1,1 78,0 a39,39 0 1,1 -78,0"/></defs>
            <text><textPath href="#cap-ef" startOffset="0">CASTLE CAPITAL · RECEPCIÓN DE FONDOS · ARMENIA · CO · </textPath></text>
          </svg>
          <div class="body">
            <img src="assets/logo-line-ink.png" alt="">
            <div class="cci">CCI</div>
          </div>
        </div>
      </div>

      <div class="foot">
        <div class="tag">Diseño<i>·</i>Estructura<i>·</i>Legado</div>
        <div class="meta">Castle Capital · Armenia, Colombia<br>Comprobante ${ref} · previo al Comprobante de conversión</div>
      </div>

    </div>
  </div>`;
}

function render(d, baseHref) {
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${esc(baseHref)}">
<title>Comprobante de entrada de fondos · ${esc(d.nombre) || 'Cliente'}</title>
<link rel="stylesheet" href="assets/tokens.css">
<link rel="stylesheet" href="docs/entrada-fondos.css">
</head>
<body class="doc-preview">
  <div class="board" id="board">${sheet(d)}</div>
  <script>
    function fitSheets(){
      var board = document.querySelector('.board');
      if(!board) return;
      var avail = board.clientWidth;
      var sheetPx = 210 * 96 / 25.4;
      var fit = Math.min(1, avail / sheetPx);
      document.querySelectorAll('.sheet').forEach(function(s){ s.style.setProperty('--fit', fit); });
    }
    window.addEventListener('resize', fitSheets);
    fitSheets();
  <\/script>
</body>
</html>`;
}

  CC.docs = CC.docs || {};
  CC.docs.entrada = { render: render };
})();
