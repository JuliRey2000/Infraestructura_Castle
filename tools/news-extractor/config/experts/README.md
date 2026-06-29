# Agentes-experto (transport `aiox-squad` → Claude local)

Aquí viven tus **agentes-experto**. Cada uno es una *persona + conocimiento* que
tú escribes y guardas localmente (estilo `copy-chief`). El pipeline los invoca a
través de **Claude Code local** (`claude -p`), usando tu **login/suscripción** —
**sin `ANTHROPIC_API_KEY` y sin facturación por API**.

> Un experto NO es un modelo entrenado. Su pericia viene de su **persona** (cómo
> piensa) y su **conocimiento** (lo que sabe). Eso es lo único que escribes.

---

## Dónde se guarda un experto

```
config/experts/<id>/
├── persona.md        ← REQUERIDO. Quién es, cómo piensa, su criterio. Es el system prompt.
└── knowledge/        ← OPCIONAL. Contexto de referencia (.md/.txt), se concatena al system prompt.
    ├── marco.md
    └── glosario.md
```

- `<id>` debe ser minúsculas, números y guiones: `crypto-expert`, `nasdaq-expert`.
- `persona.md` es obligatorio; sin él, el experto falla con elegancia (su sección
  queda "no disponible" y el run continúa).
- `knowledge/` es opcional y está capado (~60 KB) para no inflar el contexto.

Plantilla lista para copiar: **`config/experts/_template/`** (no se ejecuta).

---

## Cómo se vincula un experto a un tema (2 pasos)

**1. Crea la persona:** copia `_template/` a `config/experts/<id>/` y edita `persona.md`.

**2. Crea el manifiesto** `config/agents/manifests/<id>.yaml` (mira el ejemplo
`config/agents/manifests/example-expert.yaml.example`):

```yaml
agent:
  id: crypto-expert            # = nombre de la carpeta en config/experts/
  display_name: "Experto Cripto"
  enabled: true
  language: es

transport:
  type: aiox-squad             # ← usa Claude local
  agent: crypto-expert         # carpeta del experto (default = agent.id)
  model: sonnet                # opcional: alias (opus|sonnet|fable) o id completo
  timeout_ms: 180000           # claude headless tarda; deja >= 120000

io:
  output_schema: "agent-output.schema.json@1"

applies_to: ["crypto"]         # a qué brief(s) aplica. Vacío = todos.
```

Listo. Se auto-registra. Verifica y opera con la CLI:

```bash
news agents list                                   # debe aparecer tu experto
news agents test crypto-expert --topic crypto --with-sample   # round-trip real (1 item)
news agents enable crypto-expert | disable crypto-expert      # encender/apagar/intercambiar
news run --topic crypto                            # corre el brief completo
```

> **Un experto por tema** se logra con `applies_to: ["<tema>"]`. Para intercambiar,
> deshabilitas uno y habilitas otro (o cambias el `applies_to`).

---

## Configuración (opcional, por variables de entorno)

| Variable | Default | Para qué |
|----------|---------|----------|
| `NEWS_CLAUDE_BIN` | `claude` | Ruta/nombre del binario de Claude Code. |
| `NEWS_CLAUDE_MODEL` | (default de claude) | Modelo por defecto si el manifiesto no lo fija. |
| `NEWS_CLAUDE_PERMISSION_MODE` | `dontAsk` | Modo de permisos headless (sin prompts). |
| `NEWS_CLAUDE_KEEP_API_KEY` | (vacío) | Si `1`, NO borra `ANTHROPIC_API_KEY` (vuelve a auth por API). |
| `NEWS_EXPERTS_DIR` | `config/experts` | Cambia dónde se buscan los expertos. |

**Por defecto el transport elimina `ANTHROPIC_API_KEY` del subproceso** para
garantizar que Claude use tu suscripción y no facturación por token.

---

## Notas operativas

- **Latencia:** `claude -p` arranca un agente completo; cada experto puede tardar
  decenas de segundos. El timeout por defecto es 180s (piso 120s).
- **Sin herramientas:** corre con `--permission-mode dontAsk`; el experto solo
  sintetiza texto, no usa herramientas ni red propia.
- **Contexto limpio:** se ejecuta desde un directorio neutral para no heredar el
  `CLAUDE.md` del repo; tu `~/.claude/CLAUDE.md` (identidad Castle Capital) sí
  carga. Define la voz y reglas dentro de `persona.md`.
- **Scheduler:** el job de las 7am corre igual; asegúrate de que `claude` esté en
  el `PATH` del entorno de launchd y que tu sesión esté autenticada.
