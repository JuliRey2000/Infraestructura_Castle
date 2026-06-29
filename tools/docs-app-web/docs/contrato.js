// docs/contrato.js — Contrato de Mandato CCI.
// Portado verbatim del prototipo (project/Contrato de Mandato CCI.html): se conserva
// la hoja (tabla con thead/tfoot repetidos en cada página + watermark). El panel
// lateral y el script de localStorage se eliminan: los datos vienen del shell.
// La firma de Julián (firma-ink.png) queda embebida; el cliente firma en la línea.

(function () {
  'use strict';
  const CC = (window.CC = window.CC || {});
  const { esc, f, fmtDate } = CC.state;

// Campo de fecha formateada como span del contrato.
function fd(value, placeholder) {
  return f(fmtDate(value), placeholder);
}

function sheet(d) {
  return `
<div class="watermark" aria-hidden="true">
  <img class="emblem" src="assets/logo-line-ink.png" alt="">
  <div class="word">Castle Capital</div>
</div>

<main class="stage">
  <table class="sheet">
    <thead class="sheet-head"><tr><td>
    <header class="letterhead">
      <img class="logo" src="assets/logo-castle.png" alt="Castle Capital">
      <div class="brand">
        <div class="name">Castle Capital</div>
        <div class="tag">Diseño · Estructura · Legado</div>
      </div>
      <div class="lh-right">
        <b>Contrato de Mandato</b><br>
        Castle Crypto Income
      </div>
    </header>
    <div class="lh-rule"></div>
    </td></tr></thead>
    <tfoot class="sheet-foot"><tr><td>
    <footer class="doc-footer">
      <span class="sign"><b>Castle Capital</b> <span class="dot">·</span> Diseño · Estructura · Legado</span>
      <span>Documento confidencial</span>
    </footer>
    </td></tr></tfoot>
    <tbody><tr><td>

    <div class="doc-body">

      <div class="titleblock">
        <div class="eyebrow">Contrato de Mandato · Castle Crypto Income (CCI)</div>
        <h2>Mandato Remunerado para la Gestión Técnica de Liquidez en Protocolos DeFi</h2>
        <div class="meta">
          <div class="mi"><div class="ml">Jurisdicción</div><div class="mv">República de Colombia</div></div>
          <div class="mi"><div class="ml">Referencia</div><div class="mv">${f(d.refContrato, 'CCI-MND-2026-001')}</div></div>
          <div class="mi"><div class="ml">Fecha</div><div class="mv">${fd(d.fecha, '[fecha]')}</div></div>
        </div>
      </div>

      <p class="parties-lead">Entre los suscritos:</p>

      <div class="party">
        <div class="ptag">El Mandante · Cliente</div>
        <p>${f(d.nombre, '[Nombre completo]')}, mayor de edad, identificado con C.C. No. ${f(d.cc, '[___]')}, con domicilio en ${f(d.ciudad, '[ciudad]')}, correo electrónico ${f(d.correo, '[___]')}, quien en adelante se denominará <strong>EL MANDANTE</strong>.</p>
      </div>

      <div class="party">
        <div class="ptag">El Mandatario · Gestor</div>
        <p>${f(d.razon, 'Castle Capital Investments')}, debidamente constituida e identificada con NIT ${f(d.nit, '[___]')}, representada por ${f(d.rep, 'Julián Esteban Castillo Marulanda')}, identificado con C.C. No. ${f(d.repcc, '[___]')}, quien en adelante se denominará <strong>EL MANDATARIO</strong>.</p>
      </div>

      <div class="considerando">
        <div class="lead">Considerando:</div>
        <div class="points">
          <div class="point"><span class="mk">(i)</span><span>Que EL MANDANTE es propietario de criptoactivos y desea obtener rendimientos tanto a través de su participación en pools de liquidez de protocolos descentralizados (DeFi) como mediante la tenencia (hold) de los activos subyacentes.</span></div>
          <div class="point"><span class="mk">(ii)</span><span>Que EL MANDATARIO posee conocimiento técnico y experiencia en gestión de liquidez en Uniswap, Revert Finance y protocolos análogos.</span></div>
          <div class="point"><span class="mk">(iii)</span><span>Que EL MANDANTE ha sido informado exhaustivamente sobre los riesgos del mercado DeFi y manifiesta comprenderlos.</span></div>
          <div class="point"><span class="mk">(iv)</span><span>Que las partes desean celebrar un contrato de mandato remunerado, conservando EL MANDANTE en todo momento la propiedad y el control sobre sus activos.</span></div>
        </div>
      </div>

      <p class="acuerdan">Acuerdan las siguientes cláusulas</p>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Primera</span><h3 class="clause-title">Objeto</h3><span class="hr"></span></div>
        <p>EL MANDANTE otorga mandato remunerado a EL MANDATARIO para que este, actuando por cuenta y riesgo de EL MANDANTE, le brinde:</p>
        <div class="points">
          <div class="point"><span class="mk">(a)</span><span>Análisis técnico de oportunidades en protocolos DeFi y en criptomonedas (BTC, ETH, entre otras).</span></div>
          <div class="point"><span class="mk">(b)</span><span>Recomendaciones específicas de configuración de pools de liquidez (pares, rangos, <em>tick spacing</em>).</span></div>
          <div class="point"><span class="mk">(c)</span><span><span class="olabel">Opcional ·</span> Ejecución técnica de operaciones en blockchain, bajo instrucción expresa y previa aprobación de EL MANDANTE para cada operación relevante.</span></div>
          <div class="point"><span class="mk">(d)</span><span>Monitoreo de posiciones y reporte periódico.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Segunda</span><h3 class="clause-title">Propiedad y custodia de los activos</h3><span class="hr"></span></div>
        <div class="points">
          <div class="point"><span class="mk">2.1</span><span>Los criptoactivos objeto del mandato son y seguirán siendo en todo momento de propiedad exclusiva de EL MANDANTE.</span></div>
          <div class="point"><span class="mk">2.2</span><span>EL MANDANTE conservará el control primario de la wallet,  mediante:</span></div>
        </div>
        <div class="points" style="margin-left:41px;">
          <div class="point opt"><span class="box"></span><span>Custodia total de la llave privada por parte de EL MANDANTE.</span></div>
        </div>
        <div class="points">
          <div class="point"><span class="mk">2.3</span><span>EL MANDATARIO NO recibe, custodia ni controla los activos por cuenta propia. Cualquier acceso técnico es exclusivamente operacional para ejecutar instrucciones dentro del alcance pactado.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Tercera</span><h3 class="clause-title">Activos gestionados</h3><span class="hr"></span></div>
        <p>Los activos iniciales son: ${f(d.activosIniciales, '[listar cripto + montos]')}.</p>
        <p>Red / blockchain: ${f(d.redContrato, '[Ethereum / Arbitrum / etc.]')}.</p>
        <p>Protocolos autorizados: <span class="opt-val">Uniswap V3</span>, <span class="opt-val">Revert Finance</span>. Cualquier adición o cambio requiere anexo firmado.</p>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Cuarta</span><h3 class="clause-title">Honorarios</h3><span class="hr"></span></div>
        <p>EL MANDATARIO percibirá las siguientes remuneraciones:</p>
        <div class="points">
          <div class="point"><span class="mk">4.1</span><span><strong>Honorario fijo de onboarding:</strong> CINCO MILLONES DE PESOS COLOMBIANOS ($ 5.000.000 COP), pagaderos por anticipado al momento de la firma, por concepto de configuración inicial, análisis de perfil, apertura de wallet y primera asignación de liquidez.</span></div>
          <div class="point"><span class="mk">4.2</span><span><strong>Participación sobre ganancias (performance fee):</strong> VEINTE POR CIENTO (20 %) sobre las ganancias netas realizadas, calculadas según la Cláusula Quinta.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Quinta</span><h3 class="clause-title">Cálculo de ganancias</h3><span class="hr"></span></div>
        <div class="points">
          <div class="point"><span class="mk">5.1</span><span><em>"Ganancia neta"</em> = Valor total del portafolio al final del periodo de liquidación − Valor inicial aportado − Costos de gas y fees de protocolo − Pérdidas realizadas en el periodo.</span></div>
          <div class="point"><span class="mk">5.2</span><span>Periodicidad de liquidación: <span class="opt-val">trimestral / semestral / a la terminación</span>.</span></div>
          <div class="point"><span class="mk">5.3</span><span>Moneda de cálculo: equivalente en USD al momento del cálculo, tomando precio de <span class="opt-val">oráculo Chainlink / promedio últimas 24h CoinGecko</span>.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Sexta</span><h3 class="clause-title">Obligaciones del mandatario</h3><span class="hr"></span></div>
        <p>EL MANDATARIO se obliga a:</p>
        <div class="points">
          <div class="point"><span class="mk">(a)</span><span>Actuar con la diligencia de un buen hombre de negocios.</span></div>
          <div class="point"><span class="mk">(b)</span><span>Rendir cuentas mensualmente con reportes detallados.</span></div>
          <div class="point"><span class="mk">(c)</span><span>Informar oportunamente cambios materiales del mercado que impacten las posiciones.</span></div>
          <div class="point"><span class="mk">(d)</span><span>Mantener confidencialidad sobre la información de EL MANDANTE.</span></div>
          <div class="point"><span class="mk">(e)</span><span>No usar los activos del mandato para fines distintos a los pactados.</span></div>
          <div class="point"><span class="mk">(f)</span><span>Cumplir con las normas de prevención de lavado de activos aplicables.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Séptima</span><h3 class="clause-title">Obligaciones del mandante</h3><span class="hr"></span></div>
        <p>EL MANDANTE se obliga a:</p>
        <div class="points">
          <div class="point"><span class="mk">(a)</span><span>Pagar oportunamente los honorarios pactados.</span></div>
          <div class="point"><span class="mk">(b)</span><span>Proveer información veraz para cumplimiento KYC.</span></div>
          <div class="point"><span class="mk">(c)</span><span>Declarar el origen lícito de los criptoactivos aportados.</span></div>
          <div class="point"><span class="mk">(d)</span><span>Cumplir con sus obligaciones tributarias personales derivadas de las operaciones.</span></div>
          <div class="point"><span class="mk">(e)</span><span>Mantener actualizados sus medios de contacto y firma.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Octava</span><h3 class="clause-title">Declaraciones y exclusión de garantías</h3><span class="hr"></span></div>
        <div class="points">
          <div class="point"><span class="mk">8.1</span><span>EL MANDANTE DECLARA EXPRESAMENTE que comprende y acepta los siguientes riesgos:</span></div>
        </div>
        <div class="points" style="margin-left:41px;">
          <div class="point"><span class="mk">(a)</span><span><strong>Volatilidad extrema</strong> de los criptoactivos — la pérdida puede ser total.</span></div>
          <div class="point"><span class="mk">(b)</span><span><strong>Impermanent loss</strong> en pools de liquidez.</span></div>
          <div class="point"><span class="mk">(c)</span><span><strong>Riesgos de smart contract</strong> — hacks, bugs, exploits.</span></div>
          <div class="point"><span class="mk">(d)</span><span><strong>Riesgos de protocolo</strong> — depegs, rug pulls, liquidaciones.</span></div>
          <div class="point"><span class="mk">(e)</span><span><strong>Riesgos de borrowing y leverage</strong> — liquidación forzada por movimientos adversos del precio.</span></div>
          <div class="point"><span class="mk">(f)</span><span><strong>Riesgos regulatorios</strong> — cambios normativos en Colombia o en jurisdicciones de los protocolos.</span></div>
        </div>
        <div class="callout warn">
          <p><strong>8.2. EL MANDATARIO NO GARANTIZA:</strong> (a) rendimiento mínimo, máximo ni rango alguno; (b) preservación del capital; (c) rentabilidad positiva en ningún periodo.</p>
        </div>
        <div class="points">
          <div class="point"><span class="mk">8.3</span><span>EL MANDATARIO NO RESPONDE por: (a) hacks o fallos de protocolos de terceros (Uniswap, Revert, etc.); (b) liquidaciones producto de movimientos de mercado; (c) decisiones de EL MANDANTE de desatender recomendaciones; (d) cambios regulatorios o impositivos sobrevinientes.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Octava bis</span><h3 class="clause-title">Limitación de responsabilidad</h3><span class="hr"></span></div>
        <p>La responsabilidad máxima total de EL MANDATARIO frente a EL MANDANTE por cualquier reclamo derivado de este contrato se limita al monto de honorarios efectivamente cobrados en los doce (12) meses anteriores al evento que origine la reclamación.</p>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Novena</span><h3 class="clause-title">Naturaleza jurídica no-financiera del servicio</h3><span class="hr"></span></div>
        <div class="points">
          <div class="point"><span class="mk">9.1</span><span>Las partes reconocen expresamente que este contrato NO constituye:</span></div>
        </div>
        <div class="points" style="margin-left:41px;">
          <div class="point"><span class="mk">(a)</span><span>Un contrato de administración de recursos del público.</span></div>
          <div class="point"><span class="mk">(b)</span><span>Un contrato de fiducia mercantil.</span></div>
          <div class="point"><span class="mk">(c)</span><span>Un contrato de asesoría en valores en los términos de la Ley 964 de 2005.</span></div>
          <div class="point"><span class="mk">(d)</span><span>Un fondo de inversión colectivo.</span></div>
          <div class="point"><span class="mk">(e)</span><span>Una relación de intermediación de valores.</span></div>
        </div>
        <div class="points">
          <div class="point"><span class="mk">9.2</span><span>Los criptoactivos objeto del mandato NO son valores conforme a la definición de la Ley 964 de 2005 y la doctrina vigente de la Superintendencia Financiera de Colombia.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima</span><h3 class="clause-title">Duración</h3><span class="hr"></span></div>
        <div class="points">
          <div class="point"><span class="mk">10.1</span><span>El presente contrato tendrá una duración inicial de doce (12) meses, prorrogables automáticamente por periodos iguales.</span></div>
          <div class="point"><span class="mk">10.2</span><span>Cualquiera de las partes podrá terminar el contrato con aviso previo de treinta (30) días calendario.</span></div>
          <div class="point"><span class="mk">10.3</span><span>Terminación sin preaviso: por incumplimiento grave, fraude o incapacidad sobreviniente.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima primera</span><h3 class="clause-title">Terminación y liquidación</h3><span class="hr"></span></div>
        <p>Al terminar el contrato:</p>
        <div class="points">
          <div class="point"><span class="mk">(a)</span><span>EL MANDATARIO liquidará ordenadamente las posiciones abiertas.</span></div>
          <div class="point"><span class="mk">(b)</span><span>Se calculará el performance fee final (si aplica).</span></div>
          <div class="point"><span class="mk">(c)</span><span>Los activos permanecen en la wallet de EL MANDANTE.</span></div>
          <div class="point"><span class="mk">(d)</span><span>EL MANDATARIO entrega reporte final detallado.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima segunda</span><h3 class="clause-title">Confidencialidad</h3><span class="hr"></span></div>
        <p>Las partes se obligan a mantener confidencialidad sobre la información intercambiada, incluyendo estrategias, posiciones, saldos y metodología. Obligación vigente por 3 años tras la terminación.</p>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima tercera</span><h3 class="clause-title">Protección de datos</h3><span class="hr"></span></div>
        <p>EL MANDATARIO tratará los datos personales de EL MANDANTE conforme a la Ley 1581 de 2012 y la política de privacidad de ${f(d.razon, 'Castle Capital Investments')}, que EL MANDANTE declara haber leído y aceptado.</p>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima cuarta</span><h3 class="clause-title">Prevención de lavado de activos</h3><span class="hr"></span></div>
        <p>EL MANDANTE declara bajo gravedad de juramento que:</p>
        <div class="points">
          <div class="point"><span class="mk">(a)</span><span>Los recursos aportados provienen de actividades lícitas.</span></div>
          <div class="point"><span class="mk">(b)</span><span>No figura en listas vinculantes para Colombia (OFAC, ONU, etc.).</span></div>
          <div class="point"><span class="mk">(c)</span><span>Autoriza a EL MANDATARIO a realizar debida diligencia.</span></div>
        </div>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima quinta</span><h3 class="clause-title">Ley aplicable y resolución de conflictos</h3><span class="hr"></span></div>
        <p>Este contrato se rige por las leyes de la República de Colombia, en especial por los artículos 2142 al 2199 del Código Civil. Cualquier controversia que surja entre las partes será resuelta en primera instancia mediante un arreglo directo, para lo cual dispondrán de quince (15) días calendario; si la controversia no puede resolverse de esta manera, se someterá a la decisión de un Tribunal de Arbitramento designado por el Centro de Arbitraje y Conciliación de la Cámara de Comercio de Bogotá, que se sujetará a sus reglamentos y decidirá en derecho.</p>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima sexta</span><h3 class="clause-title">Modificaciones</h3><span class="hr"></span></div>
        <p>Cualquier modificación debe constar por escrito y firmada por ambas partes.</p>
      </section>

      <section class="clause">
        <div class="clause-head"><span class="clause-no">Décima séptima</span><h3 class="clause-title">Notificaciones</h3><span class="hr"></span></div>
        <p>Para todos los efectos, las partes recibirán notificaciones en los siguientes medios:</p>
        <div class="points">
          <div class="point"><span class="mk">·</span><span><strong>EL MANDANTE:</strong> correo ${f(d.correo, '[___]')}, domicilio en ${f(d.ciudad, '[ciudad]')} · Cel.: ${f(d.tel, '[___]')}.</span></div>
          <div class="point"><span class="mk">·</span><span><strong>EL MANDATARIO:</strong> ${f(d.razon, 'Castle Capital Investments')} — Armenia, Quindío, Colombia. Correo: steban_04@outlook.com · Cel.: 320 945 4181.</span></div>
        </div>
      </section>

      <p class="sign-intro">Firmado en ${f(d.ciudadFirma, '[ciudad]')}, el ${fd(d.fecha, '[fecha]')}, en dos (2) ejemplares de idéntico tenor y valor.</p>

      <div class="signatures">
        <div class="sigbox">
          <div class="sigline"></div>
          <div class="role">El Mandante</div>
          <div class="who"><b>${f(d.nombre, '[Nombre completo]')}</b><br>C.C. ${f(d.cc, '[___]')}</div>
        </div>
        <div class="sigbox">
          <img class="sig-ink" src="assets/firma-ink.png" alt="Firma de Julián Esteban Castillo Marulanda">
          <div class="sigline"></div>
          <div class="role">El Mandatario</div>
          <div class="who"><b>${f(d.razon, 'Castle Capital Investments')}</b><br>Rep.: ${f(d.rep, 'Julián Esteban Castillo Marulanda')}<br>C.C. ${f(d.repcc, '[___]')}</div>
        </div>
      </div>

    </div>
    </td></tr></tbody>
  </table>
</main>`;
}

function render(d, baseHref) {
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${esc(baseHref)}">
<title>Contrato de Mandato CCI — ${esc(d.nombre) || 'Cliente'}</title>
<link rel="stylesheet" href="assets/fonts/fonts.css">
<link rel="stylesheet" href="docs/contrato.css">
</head>
<body>
${sheet(d)}
</body>
</html>`;
}

  CC.docs = CC.docs || {};
  CC.docs.contrato = { render: render };
})();
