// docs/carta.js — Carta de bienvenida.
// Texto neutro en género; las frases fuertes se resaltan en gold (<em> → serif dorado).
(function () {
  'use strict';
  const CC = (window.CC = window.CC || {});
  const { esc, fmtDateShort } = CC.state;

function sheet(d) {
  const nombre = (d.nombre || '').trim();
  const primerNombre = nombre.split(/\s+/)[0] || '';
  const sal = primerNombre
    ? `<span class="nm">${esc(primerNombre)}</span>`
    : '<span class="nm empty">tu cliente</span>';

  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let metaDate = fmtDateShort(d.fecha);
  if (!metaDate) {
    const now = new Date();
    metaDate = `${now.getDate()} ${meses[now.getMonth()]} ${now.getFullYear()}`;
  }

  // <em> = resalte dorado (Cormorant itálica, gold). Reservado para las frases fuertes.
  const body = `
    <p>Tú ya lo sentías antes de poder nombrarlo.</p>

    <p>Esa incomodidad al ver el dinero quieto en una cuenta y asumir que, por estar inmóvil, está protegido. Esa sensación al mirar lo que hace la mayoría y notar, aunque no pudieras explicarlo del todo, que había algo esencial que <em>no encajaba</em>. Tu forma de ver esto nunca fue la misma que la del banco, la del vecino o la de muchas ideas con las que creciste.</p>

    <p>Quienes miran el mundo así a veces tardan en encontrar las palabras, pero suelen adelantarse cuando llega la hora de tomar decisiones que <em>cambian el rumbo</em>.</p>

    <p>Déjame poner en palabras algo que <em>ya intuías</em>.</p>

    <p>El dinero es <em>tiempo, esfuerzo y valor acumulado</em>. En él queda guardado algo de cada hora trabajada, de cada problema resuelto y de cada placer postergado para construir algo útil. Por eso, lo que ocurre con el dinero toca una fibra mucho más profunda que lo técnico.</p>

    <p>Y ahí aparece el problema: el dinero de siempre <em>pierde fuerza con el tiempo</em>.</p>

    <p>La inflación avanza en silencio. La emisión monetaria sucede lejos de la vida cotidiana, pero sus efectos llegan igual. Poco a poco, el fruto de años de trabajo se desgasta mientras muchos creen que sigue intacto. El sistema fue moldeado de una manera en la que el tiempo <em>castiga al que conserva</em> y <em>beneficia al que emite</em>.</p>

    <p>Por eso lo que está ocurriendo con cripto tiene un <em>peso histórico</em> difícil de ignorar. Se está abriendo una forma distinta de entender y resguardar el valor. Por primera vez, existe una infraestructura en la que las reglas no dependen del capricho de una autoridad, y donde guardar valor responde a una lógica más transparente y resistente al deterioro arbitrario.</p>

    <p>Lo que hiciste estos días fue <em>tomar posición</em> frente al sistema financiero que se está formando, antes de que resulte evidente para todos. Y en casi todos los momentos decisivos de la historia, esa ventaja de tiempo fue la diferencia entre quienes construyen patrimonio y quienes solo alcanzan a verlo cuando ya pasó enfrente.</p>

    <p>Jobs construyó Apple porque <em>vio venir</em> algo que otros todavía no entendían con claridad. Al principio hubo escepticismo. Después llegó el reconocimiento. Casi siempre ocurre así.</p>

    <p>Hoy mucha gente llama especulación a procesos que, vistos con distancia, terminan siendo <em>señales tempranas</em> de un cambio mucho más grande.</p>

    <p>Esa forma de leer el presente, de captar lo que todavía no es evidente pero ya empezó a moverse, suele separar a quienes <em>actúan a tiempo</em> de quienes años después se preguntan cómo no lo vieron venir.</p>
  `;
  const bienvenida = d.genero === 'f' ? 'Bienvenida.' : 'Bienvenido.';
  const closing = `<span class="seen">Tú ya lo veías.</span><br><span class="welcome-word">${bienvenida}</span>`;

  return `
  <article class="sheet" id="sheet">
    <header class="lh">
      <img src="assets/logo-castle.png" alt="Castle Capital">
      <div class="id">
        <div class="name">Castle <em>Capital</em></div>
        <div class="tag">Diseño · Estructura · Legado</div>
      </div>
      <div class="meta">
        <div class="k">Bienvenida</div>
        <div class="v" id="metaDate">${esc(metaDate)}</div>
      </div>
    </header>

    <div class="eyebrow">El nuevo capítulo del dinero</div>
    <div class="gold-rule"></div>

    <h1 class="salut">Para ${sal},</h1>

    <div class="body" id="body">${body}</div>

    <div class="closing" id="closing">${closing}</div>

    <div class="sig">
      <div class="nm">Julián Castillo</div>
      <div class="firm">Castle Capital</div>
    </div>

    <div class="sheet-foot">
      <b>Castle Capital</b><span class="dot">·</span>Diseño<span class="dot">·</span>Estructura<span class="dot">·</span>Legado
    </div>
  </article>`;
}

function render(d, baseHref) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${esc(baseHref)}">
<title>Carta de Bienvenida — ${esc(d.nombre) || 'Cliente'}</title>
<link rel="stylesheet" href="assets/fonts/fonts.css">
<link rel="stylesheet" href="docs/carta.css">
</head>
<body>
  <div class="stage">${sheet(d)}</div>
</body>
</html>`;
}

  CC.docs = CC.docs || {};
  CC.docs.carta = { render: render };
})();
