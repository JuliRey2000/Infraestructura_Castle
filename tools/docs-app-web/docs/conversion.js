// docs/conversion.js — Comprobante de conversión (verificación on-chain).
// Portado verbatim del prototipo (project/Comprobante de conversión.html),
// tema claro para impresión. Wallet enmascarada; hash completo (dato público).

(function () {
  'use strict';
  const CC = (window.CC = window.CC || {});
  const { esc, fmtDate, maskWallet } = CC.state;

const ICON = {
  asset: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.2 9.3c0-1 1.3-1.6 2.8-1.6s2.8.6 2.8 1.6-1.1 1.4-2.8 1.6c-1.7.2-2.8.7-2.8 1.7s1.3 1.7 2.8 1.7 2.8-.7 2.8-1.7"/></svg>',
  net: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><circle cx="5" cy="18" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M10.7 6.7 6.3 15.5M13.3 6.7l4.4 8.8M7.4 18h9.2"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1H5a2 2 0 0 0 0 4h0M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5H6"/><circle cx="16" cy="14" r="1"/></svg>',
  hash: '<svg viewBox="0 0 24 24"><path d="M9 3 7 21M17 3l-2 18M4 8h16M3 16h16"/></svg>',
  date: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>',
  status: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3 4.7-4.6"/></svg>',
};

function sheet(d) {
  const isUSD = d.monedaEfectivo === 'USD';
  const cliente = esc(d.nombre) || 'Cliente / Titular';
  const efectivo = esc(d.efectivo) || '0';
  const moneda = esc(d.monedaEfectivo) || 'COP';
  const tasa = esc(d.tasa) || '—';
  const usd = esc(d.usd) || '0,00';
  // Si el efectivo ya es USD, la cripto entregada es 1:1 por defecto (sin tasa COP).
  const usdcRaw = (d.usdc && String(d.usdc).trim()) ? d.usdc : (isUSD ? d.efectivo : '');
  const usdc = esc(usdcRaw) || '0,00';
  const activoNombre = esc(d.activoNombre) || 'USD Coin';
  const red = esc(d.red) || '—';
  const wallet = esc(maskWallet(d.wallet)) || '0x…';
  const hash = esc(d.hash) || '0x…';
  const ref = esc(d.refConversion) || '—';
  const fecha = esc(fmtDate(d.fecha)) || '—';
  const hora = esc(d.hora) || '';

  // En USD no anteponemos símbolo (la moneda va como sufijo): "2.000 USD".
  const effDisp = (isUSD ? '' : '$ ') + efectivo;
  const arrow = '<div class="farrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>';
  const effCell = `<div class="fcell"><div class="k">Efectivo recibido</div><div class="v">${effDisp}<span class="cur">${moneda}</span></div><div class="note">Recibido en efectivo</div></div>`;
  const usdCell = `<div class="fcell"><div class="k">Equivalente en USD</div><div class="v">$ ${usd}<span class="cur">USD</span></div><div class="note">Tasa · ${tasa}</div></div>`;
  const usdcCell = `<div class="fcell accent"><div class="k">Cripto entregada</div><div class="v">${usdc}<span class="cur">USDC</span></div><div class="note">Depositado en wallet del cliente</div></div>`;
  const flow = isUSD
    ? `<div class="flow flow-2">${effCell}${arrow}${usdcCell}</div>`
    : `<div class="flow flow-3">${effCell}${arrow}${usdCell}${arrow}${usdcCell}</div>`;

  return `
  <div class="sheet dark">
    <div class="watermark">
      <img class="emblem" src="assets/logo-line-white.png" alt="">
      <div class="word">Castle Capital</div>
    </div>
    <div class="doc">

      <div class="head">
        <div class="mark">
          <img src="assets/logo-line-white.png" alt="Castle Capital">
          <div>
            <div class="wm-name">Castle Capital</div>
            <div class="wm-tag">Diseño<b>·</b>Estructura<b>·</b>Legado</div>
          </div>
        </div>
        <div class="doctype">
          <div class="ey">Comprobante de conversión</div>
          <div class="prod"><i></i> Castle Crypto Income</div>
        </div>
      </div>
      <div class="rule"></div>

      <div class="titlerow">
        <div>
          <h1>Comprobante de <span class="gold">conversión</span></h1>
        </div>
        <div class="refbox">
          <div class="lab">Referencia</div>
          <div class="ref">${ref}</div>
          <div class="date"><span class="lab2">Fecha de operación</span>${fecha}<br>${hora}</div>
        </div>
      </div>

      <div class="constancia">
        Castle Capital deja constancia de la recepción de efectivo y su conversión a activos digitales, entregados directamente a favor de:
      </div>
      <div class="client">
        <div>
          <div class="who-lab">Cliente / Titular</div>
          <div class="who">${cliente}</div>
        </div>
      </div>

      <div class="sec-eyebrow">Resumen de la conversión</div>
      ${flow}

      <div class="sec-eyebrow">Detalle de la operación</div>
      <div class="detail">
        <div class="drow">
          <div class="dk">${ICON.asset} Activo digital</div>
          <div class="dv"><span class="badge asset"><span class="tok">$</span> USDC</span> ${activoNombre}</div>
        </div>
        <div class="drow">
          <div class="dk">${ICON.net} Red blockchain</div>
          <div class="dv"><span class="badge net">${red}</span></div>
        </div>
        <div class="drow">
          <div class="dk">${ICON.wallet} Wallet del cliente</div>
          <div class="dv mono">${wallet}</div>
        </div>
        <div class="drow">
          <div class="dk">${ICON.hash} Hash de transacción</div>
          <div class="dv mono"><span class="hashfull">${hash}</span></div>
        </div>
        <div class="drow">
          <div class="dk">${ICON.status} Estado</div>
          <div class="dv"><span class="badge ok"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg> Confirmada on-chain</span></div>
        </div>
        <div class="drow">
          <div class="dk">${ICON.date} Fecha y hora</div>
          <div class="dv mono">${fecha} · ${hora}</div>
        </div>
      </div>

      <div class="ownership">
        <svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        <div class="ot">
          <strong>Propiedad y custodia.</strong> Los activos digitales descritos en este comprobante fueron entregados directamente a la wallet personal del cliente y son de su <strong>exclusiva propiedad y control</strong>. Castle Capital no custodia, retiene ni administra fondos de terceros: actúa <em>únicamente</em> como facilitador de la conversión. Una vez confirmada la transacción en la red, la responsabilidad sobre las claves privadas y los activos recae enteramente en el titular de la wallet.
        </div>
      </div>

      <div class="signrow">
        <div class="signblock">
          <img class="sig" src="assets/firma-gold.png" alt="Firma de Julián Castillo">
          <div class="sigline">
            <div class="nm">Julián Esteban Castillo Marulanda</div>
            <div class="role">CEO · <b>Castle Capital</b></div>
          </div>
        </div>
        <div class="seal">
          <div class="outer"></div>
          <svg class="ring" viewBox="0 0 100 100">
            <defs><path id="cap-cv" d="M50,50 m-39,0 a39,39 0 1,1 78,0 a39,39 0 1,1 -78,0"/></defs>
            <text><textPath href="#cap-cv" startOffset="0">CASTLE CAPITAL · CONVERSIÓN VERIFICADA · ON-CHAIN · </textPath></text>
          </svg>
          <div class="body">
            <img src="assets/logo-line-white.png" alt="">
            <div class="cci">CCI</div>
          </div>
        </div>
      </div>

      <div class="foot">
        <div class="tag">Diseño<i>·</i>Estructura<i>·</i>Legado</div>
        <div class="meta">Castle Capital · Armenia, Colombia<br>Comprobante ${ref} · verificable on-chain</div>
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
<title>Comprobante de conversión · ${esc(d.nombre) || 'Cliente'}</title>
<link rel="stylesheet" href="assets/tokens.css">
<link rel="stylesheet" href="docs/conversion.css">
</head>
<body>
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
  CC.docs.conversion = { render: render };
})();
