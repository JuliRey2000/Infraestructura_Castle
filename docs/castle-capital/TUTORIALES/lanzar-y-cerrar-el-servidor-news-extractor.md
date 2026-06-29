# Cómo lanzar y cerrar un servidor — Guía detallada (News Extractor)

> **Para quién es esto:** Julián / Castle Capital.
> **Qué cubre:** qué es un servidor local, cómo se lanza uno en general, y el
> paso a paso concreto para el **News Extractor** (`tools/news-extractor`),
> incluyendo cómo dejarlo corriendo y, sobre todo, **cómo cerrarlo bien**.
> **Sistema de referencia:** macOS 26.5 · Node v24.2.0 · zsh.

---

## 0. Conceptos previos (1 minuto de teoría)

Antes del paso a paso, cuatro ideas que hacen que todo lo demás tenga sentido:

| Concepto | Qué significa en la práctica |
|----------|------------------------------|
| **Servidor** | Un programa que se queda **corriendo, esperando peticiones**. No "termina y ya": se queda vivo escuchando. Tu navegador (el cliente) le pide páginas y él responde. |
| **Puerto** | Un número (ej. `8730`) que identifica "por dónde" escucha el servidor en tu computador. Solo **un** programa puede usar un puerto a la vez. Por eso a veces sale "puerto ocupado". |
| **Loopback / `127.0.0.1` / `localhost`** | Una dirección que **solo existe dentro de tu computador**. Nadie de internet la puede ver. El News Extractor escucha **solo aquí** por seguridad: no expone tus datos ni tus claves a la red. |
| **Foreground vs Background** | **Foreground** (primer plano): el servidor "ocupa" tu terminal; ves sus logs y lo cierras con `Ctrl-C`. **Background** (segundo plano): corre suelto, te devuelve la terminal para seguir trabajando, pero tienes que cerrarlo con un comando aparte. |

**Regla de oro:** un servidor que lanzas **se queda corriendo hasta que lo cierras
tú** (o hasta que apagas/reinicias el computador). No se cierra solo al terminar
de ver la página.

---

## 1. El patrón general para lanzar *cualquier* servidor

Casi todos los servidores locales siguen este mismo ritual:

1. **Ir a la carpeta del proyecto** (`cd ruta/del/proyecto`).
2. **Ejecutar el comando que arranca el servidor** (varía por proyecto: `node ...`,
   `npm run dev`, `python -m http.server`, etc.).
3. **Anotar en qué puerto quedó** (lo dice en pantalla, ej. `http://127.0.0.1:8730`).
4. **Abrir esa dirección en el navegador.**
5. Al terminar, **cerrarlo** (`Ctrl-C` si está en primer plano, o matar el
   proceso por su puerto si está en segundo plano — ver sección 5).

El News Extractor es exactamente este patrón. Vamos a lo concreto.

---

## 2. Prerrequisitos del News Extractor

- **Node.js 18 o superior** instalado (tienes v24.2.0 ✓). Verifícalo con:
  ```bash
  node --version
  ```
- **Estar en la carpeta de la herramienta:**
  `/Users/usuario1/Software/aios-core/tools/news-extractor`
- **(Opcional pero recomendado) un archivo `.env` con tus claves** en esa misma
  carpeta. Sin claves la interfaz **navega igual**, pero el botón "Run now" y el
  envío a Telegram no funcionan. Ver el tutorial de claves / `.env`.

---

## 3. Lanzar el servidor — paso a paso

### Opción A — Primer plano (la recomendada para uso normal)

Es la más simple y la más fácil de cerrar.

**Paso 1.** Abre la terminal y entra a la carpeta:
```bash
cd /Users/usuario1/Software/aios-core/tools/news-extractor
```

**Paso 2.** Arranca el servidor:
```bash
node bin/news.js serve
```

**Paso 3.** Vas a ver una línea como esta:
```
Web UI local en http://127.0.0.1:8730  (Ctrl-C para detener)
```
Eso significa que **ya está corriendo**. La terminal queda "ocupada" mostrando
los logs — eso es normal y esperado. **No cierres esa ventana** mientras uses la
interfaz.

**Paso 4.** Abre en tu navegador:
```
http://localhost:8730
```
(o `http://127.0.0.1:8730` — son equivalentes).

> Para cerrarlo: vuelve a esa terminal y presiona **`Ctrl-C`** (ver sección 5).

---

### Opción B — Puerto distinto

Si el `8730` está ocupado o quieres otro, usa `--port`:
```bash
node bin/news.js serve --port 9000
```
Y abres `http://localhost:9000`. El puerto por defecto, si no pasas `--port`, es
**8730**.

---

### Opción C — Segundo plano (para dejarlo corriendo y seguir usando la terminal)

Solo si necesitas la terminal libre. Agrega `&` al final para soltarlo:
```bash
cd /Users/usuario1/Software/aios-core/tools/news-extractor
node bin/news.js serve --port 8730 &
```
La terminal te devuelve el control de inmediato. **Ojo:** ahora `Ctrl-C` ya **no**
lo cierra; tienes que matarlo por su puerto (ver sección 5, Opción B).

---

## 4. Verificar que está corriendo

Tres formas, de la más simple a la más técnica:

**1. El navegador.** Si `http://localhost:8730` carga la interfaz (4 pestañas:
Dashboard, Briefs, Agentes, Settings), está vivo.

**2. Ver quién usa el puerto** (te da el PID = número de proceso):
```bash
lsof -ti:8730
```
- Si imprime un número (ej. `51759`) → está corriendo, ese es su PID.
- Si no imprime nada → **no** está corriendo.

**3. Diagnóstico completo de la herramienta** (claves, config, fuentes, Telegram):
```bash
cd /Users/usuario1/Software/aios-core/tools/news-extractor
node bin/news.js doctor
```
Te lista qué está OK y qué falta (ej. claves ausentes, Telegram sin configurar).

---

## 5. Cerrar el servidor — paso a paso (la parte importante)

Cómo lo cierras **depende de cómo lo lanzaste**.

### Opción A — Si lo lanzaste en PRIMER plano (Opción 3A)

1. Vuelve a la terminal donde está corriendo (la que muestra los logs).
2. Presiona **`Ctrl-C`** (la tecla `Control` + la letra `C`).
3. El proceso se detiene y la terminal vuelve a quedar libre. Listo.

> Si cierras la ventana de la terminal completa, **normalmente** también lo
> cierra, pero `Ctrl-C` es lo correcto y limpio.

### Opción B — Si lo lanzaste en SEGUNDO plano (Opción 3C) o no sabes cuál

Lo cierras **por su puerto**. Este comando busca el proceso que usa el puerto
8730 y lo termina:
```bash
lsof -ti:8730 | xargs kill
```
Qué hace, por partes:
- `lsof -ti:8730` → obtiene el PID del proceso en el puerto 8730.
- `| xargs kill` → le pasa ese PID al comando `kill`, que lo termina.

**Verifica que quedó cerrado** (no debe imprimir nada):
```bash
lsof -ti:8730
```

Si por alguna razón no muere (raro), fuérzalo con `-9`:
```bash
lsof -ti:8730 | xargs kill -9
```
> `kill -9` es el "apagón forzado". Úsalo solo si el `kill` normal no funcionó.

---

## 6. Reiniciar el servidor (cerrar + volver a abrir)

**Esto es obligatorio cada vez que editas el `.env`**, porque las claves se leen
**solo al arrancar**. Si cambias una clave y no reinicias, el servidor sigue con
la versión vieja.

Secuencia completa:
```bash
# 1. Cerrar el que esté corriendo (no falla si no hay ninguno)
lsof -ti:8730 | xargs kill 2>/dev/null

# 2. Entrar a la carpeta
cd /Users/usuario1/Software/aios-core/tools/news-extractor

# 3. Levantar de nuevo
node bin/news.js serve --port 8730
```

---

## 7. Solución de problemas (troubleshooting)

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `EADDRINUSE` / "address already in use" | El puerto 8730 ya está ocupado (quizás un servidor anterior que no cerraste) | Ciérralo con `lsof -ti:8730 \| xargs kill` y vuelve a intentar; o usa otro puerto con `--port 9000` |
| La página no carga | El servidor no está corriendo | Verifica con `lsof -ti:8730`. Si no hay PID, lánzalo otra vez (sección 3) |
| Edité el `.env` pero no toma las claves nuevas | El servidor lee el `.env` solo al arrancar | **Reinícialo** (sección 6) |
| "Run now" no genera brief | Faltan claves de fuentes o `ANTHROPIC_API_KEY` | Corre `node bin/news.js doctor` para ver qué falta |
| El brief se genera pero no llega a Telegram | Token/chat_id ausentes o el bot no recibió tu `/start` | `node bin/news.js doctor` (revisa "Telegram configurado"); abre tu bot y mándale `/start` |
| `command not found: node` | Node no está en el PATH de esa terminal | Abre una terminal nueva o reinstala Node |

---

## 8. Referencia rápida (chuleta)

```bash
# Ir a la carpeta de la herramienta
cd /Users/usuario1/Software/aios-core/tools/news-extractor

# LANZAR (primer plano — Ctrl-C para cerrar)
node bin/news.js serve

# LANZAR en otro puerto
node bin/news.js serve --port 9000

# LANZAR en segundo plano (terminal libre)
node bin/news.js serve --port 8730 &

# ¿Está corriendo? (imprime PID si sí)
lsof -ti:8730

# CERRAR (segundo plano o desde otra terminal)
lsof -ti:8730 | xargs kill

# REINICIAR (tras editar .env)
lsof -ti:8730 | xargs kill 2>/dev/null
node bin/news.js serve --port 8730

# Diagnóstico de la herramienta
node bin/news.js doctor

# Ayuda / todos los comandos de la CLI
node bin/news.js help
```

**La interfaz web vive en:** `http://localhost:8730` (solo en tu computador).

---

## 9. Nota de filosofía (CLI First)

El News Extractor está diseñado bajo el principio **CLI First**: la inteligencia
real vive en la línea de comandos (`node bin/news.js ...`). La interfaz web **solo
observa y dispara** las mismas acciones que ya existen en la CLI — nunca hace algo
que no puedas hacer desde la terminal. Por eso, si la web alguna vez falla, **la
CLI siempre es el plan B confiable**:
```bash
node bin/news.js run --all      # corre todos los temas sin necesidad de la web
node bin/news.js brief latest   # ver el último brief de cada tema
```

---

*Documento de tutorial — Castle Capital · News Extractor.*
*Ubicación: `docs/castle-capital/TUTORIALES/`.*
