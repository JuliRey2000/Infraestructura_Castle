# Security — Asesoría Capital

Estado de los hallazgos de la auditoría @cyber-chief del 2026-05-22 sobre
`tools/asesoria-capital/`.

## Estado de hallazgos

| ID | Hallazgo | Severidad | Estado | Implementación |
|----|----------|-----------|--------|---------------|
| H1 | Sin CSP ni cabeceras de seguridad | ALTO | Resuelto | `<meta http-equiv>` en `index.html` + `netlify.toml` con headers reales |
| H2 | Sin protección anti-bot | ALTO | Resuelto (parcial) | Honeypot `#hp-company` + clase `.visually-hidden-bot-trap`. Cloudflare Turnstile pospuesto 1 mes |
| H3 | Credenciales reales en `config.example.js` | ALTO | Resuelto | Placeholders `YOUR_PROJECT.supabase.co` / `YOUR_PUBLISHABLE_ANON_KEY_HERE` |
| H4 | RLS `WITH CHECK (true)` no valida consentimiento | ALTO | Resuelto | Migration 002 — `acepta_contacto = true` + formato nombre/email/celular |
| H5 | Capital exacto persistido | MEDIO | Resuelto (2 fases) | `capitalToRange()` en `engine.js` + migration **003a** (ADD `capital_rango`, no destructivo) + migration **003b** (DROP `capital`, destructivo, correr después) |
| H6 | `escape()` incompleta (faltaban `'` y `` ` ``) | MEDIO | Resuelto | OWASP XSS Cheat Sheet completo en `index.html:654-664` |
| H7 | `innerHTML` en `chatAddMessage` sin contrato explícito | MEDIO | Resuelto | Refactor defensivo: nodo aislado + JSDoc del contrato |
| H8 | Sin documentación de política de seguridad | BAJO | Resuelto | Este archivo |
| H9 | `target="_blank"` sin `rel="noreferrer"` | BAJO | Resuelto | 4 links actualizados a `rel="noopener noreferrer"` |
| H10 | Sin rate-limiting global | MEDIO | Diferido | Revisión a 1 mes — escalar a Edge Function si honeypot no basta |

## Políticas

### SRI (Subresource Integrity)

Cualquier recurso futuro cargado desde un dominio externo (CDN, third-party
JS) **DEBE** incluir `integrity="sha384-..."` y `crossorigin="anonymous"`.
Hoy todos los `<script>` y `<link>` son `self`, por lo que no aplica.

Comando para generar el hash:

```bash
openssl dgst -sha384 -binary archivo.js | openssl base64 -A
```

### Honeypot anti-bot

El campo `#hp-company` está oculto vía CSS (`position: absolute; left: -9999px`)
en lugar de `display: none` (los bots modernos detectan el segundo).
`saveProspectAsync` retorna silenciosamente si el campo viene con valor —
nunca mostrar error, porque un bot que recibe error reintenta.

**Revisión a 1 mes (2026-06-22):**

- Si la tasa de bots > 20% del tráfico → escalar a Cloudflare Turnstile o
  Edge Function con rate-limiting por IP.
- Si la tasa es baja → mantener honeypot como única capa.

Métricas a comparar: leads/mes pre-honeypot vs post-honeypot, ratio de
filas con `acepta_contacto = false` rechazadas por la RLS.

### Credenciales

- `config.js` **nunca** se commitea (está en `.gitignore`).
- La `anon key` de Supabase es publishable; la RLS bloquea SELECT, por lo
  que su exposición pública no compromete datos. **No rotar** salvo que se
  detecte uso indebido.
- Si por error se sube `config.js` con valores reales:
  1. `git rm --cached config.js && git commit && git push`
  2. Rotar key desde Supabase Dashboard como precaución.

### Validación de inputs (defense in depth)

Las validaciones del cliente (`validateStep`) se duplican a nivel DB:

- Frontend: regex de email/celular, requiere ambos checkboxes.
- Supabase RLS (migration 002): `acepta_contacto = true` + regex.
- Supabase CHECK constraints: `riesgo IN (...)`, `experiencia IN (...)`,
  `nombre <= 120 chars`.

Un atacante que haga POST manual a `/rest/v1/prospects` sin pasar por la UI
encontrará las mismas validaciones a nivel DB.

## Trade-off conocido: `'unsafe-inline'` en `script-src`

El CSP actual permite `script-src 'self' 'unsafe-inline'` porque la lógica de
la app vive en un `<script>` inline grande dentro de `index.html` (línea 464+).
Sin `'unsafe-inline'`, el navegador bloquea ese bloque entero y el formulario
queda inoperante.

**Mitigaciones que sostienen la defensa en profundidad:**

- `escape()` con cobertura OWASP completa (`& < > " ' \``).
- `chatAddMessage` con contrato JSDoc: solo CHAT_KB estático o input
  pre-sanitizado.
- RLS endurecida en Supabase (migration 002) — defensa server-side.
- `frame-ancestors 'none'` activo en producción vía HTTP header (netlify.toml).

**Refactor pendiente (futuro):** extraer el bloque inline a `app.js` externo
para volver a `script-src 'self'` estricto. Tarea de ~1 día, no urgente.

## Próxima auditoría

**Q3 2026** — revisar:

- Métricas de honeypot vs bots (decisión H10).
- Si se agregaron dependencias nuevas (npm audit / supply chain).
- Si se agregó algún recurso external (validar SRI).
- Si se cambió el schema (validar que RLS sigue endurecida).

## Referencias

- `.claude/CLAUDE.md` — Castle Capital Security Standards (global)
- `.claude/rules/castle-capital-security-agents.md` — Routing a @cyber-chief
- Skill `/castle-capital-security` — Auditoría 5 fases
- OWASP XSS Cheat Sheet — patrones de escape
