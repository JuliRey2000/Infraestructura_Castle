# Castle Capital — Generador de Documentos (app web local)

App web local de **cero dependencias** para generar todos los documentos de un
cliente nuevo de **Castle Crypto Income (CCI)** desde un solo formulario maestro.
Llenas los datos del cliente una vez y salen los 4 documentos listos para imprimir
y firmar — con la firma de Julián ya embebida.

## Cómo abrirla

**Opción A — doble clic (recomendada):** abre `index.html` en tu navegador
(Chrome, Edge o Safari). Funciona offline; no necesita servidor ni instalación.

**Opción B — servidor local** (si el navegador bloquea algún recurso vía `file://`):

```bash
cd tools/docs-app-web
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## Cómo se usa

1. **Cliente:** arriba a la izquierda eliges un cliente guardado, o **Nuevo** para
   crear uno. **Duplicar** copia el cliente actual; **Borrar** lo elimina.
   - Cada cliente nuevo recibe **referencias consecutivas automáticas**
     (CCI-EF-0001, 0002…) y la **fecha de hoy** ya cargada (las puedes cambiar).
2. **Formulario:** rellena los campos. Se guarda solo, automáticamente, en el
   navegador. El selector **Solo este documento / Todos los campos** (arriba del
   formulario) filtra los campos: en "Solo este documento" ves únicamente lo que
   necesita la pestaña activa.
   - **Moneda del efectivo (COP / USD):** en los comprobantes elige si recibiste
     pesos o dólares. Si recibes **USD en efectivo** (ej. 2.000 USD), el documento
     omite el paso de tasa/conversión y entrega el USDC 1:1 — sin pasar por pesos.
   - **Montos con formato automático:** escribe `8100000` y al salir del campo se
     muestra `8.100.000` (miles con punto, decimales con coma).
3. **Documentos:** las pestañas de arriba muestran cada documento en vivo:
   - **Contrato de Mandato** — el cliente firma; tu firma ya está embebida.
   - **Comprobante de entrada de fondos** — efectivo recibido, conversión en proceso.
   - **Comprobante de conversión** — confirmación on-chain con hash verificable.
   - **Carta de bienvenida** — texto neutro, solo requiere el nombre del cliente.
4. **Imprimir / Guardar PDF:** botón superior derecho. Usa el diálogo del navegador
   → destino "Guardar como PDF". El nombre de archivo se sugiere solo
   (ej. `Contrato de Mandato — Camila Restrepo.pdf`). Si faltan datos clave del
   documento (nombre, cédula, etc.), la app **avisa antes de imprimir**.
5. **Respaldo:** abajo a la izquierda, **Respaldo** exporta todos los clientes a un
   archivo JSON; **Importar** los restaura. Útil para backup o pasar de equipo.

## Notas de privacidad y seguridad

- Los datos de los clientes se guardan **solo en este navegador** (`localStorage`),
  nunca se envían a ningún servidor. Usa **Respaldo** para no perderlos.
- Fuentes self-hosted (sin CDN), wallets enmascaradas a los últimos 4 caracteres en
  los documentos, hash de transacción completo (dato público on-chain).
- Cero dependencias externas: HTML/CSS/JS puro.

## Estructura

```
index.html            App: roster + formulario maestro + pestañas + preview
app.js / app.css      Lógica y estilos del shell
lib/state.js          Modelo de datos maestro, defaults y helpers (formato, máscara)
lib/store.js          Roster de clientes en localStorage + export/import
docs/<doc>.js         Render de cada documento (state → HTML aislado en iframe)
docs/<doc>.css        Estilos de cada documento (copiados verbatim del prototipo)
assets/               Logos, firmas, tokens.css y fuentes self-hosted (assets/fonts/)
project/              Prototipos originales de Claude Design — REFERENCIA de diseño
```

Cada documento se renderiza dentro de su propio `<iframe>` para aislar los estilos
(los prototipos reutilizan nombres de clase) y conservar el diseño pixel-perfect,
incluido el encabezado/pie repetido en cada página del contrato al imprimir.

---

> Los archivos en `project/` son los prototipos originales exportados de
> [Claude Design](https://claude.ai/design). Se conservan como **referencia de
> diseño**; la app de producción vive en la raíz de `tools/docs-app-web/`.
