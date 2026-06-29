# news-extractor

Extractor de noticias diario para **Castle Capital**. Cada mañana agrega noticias de
fuentes confiables, las normaliza y deduplica, las pasa por **agentes de análisis
pluggables** (incluido un sintetizador IA con Claude) y entrega un *brief* accionable
en **markdown**, una **web local** y un **push a Telegram**.

> **CLI First.** Toda la inteligencia vive en la CLI. La web y el scheduler solo
> invocan los mismos comandos. Nada es requisito de nada: funciona 100% sin web.

---

## Quickstart

```bash
cd tools/news-extractor
cp .env.example .env          # 1. rellena tus claves (todas tienen free tier)
node bin/news.js doctor       # 2. valida config, claves y permisos
node bin/news.js run --topic crypto   # 3. genera el primer brief
```

El brief queda en `docs/news-extractor/briefs/crypto/<fecha>.md`.

### Claves gratuitas necesarias

| Variable | Fuente | Para qué |
|----------|--------|----------|
| `COINGECKO_API_KEY` | [CoinGecko](https://www.coingecko.com/en/api) | Cripto (100+ fuentes) |
| `MARKETAUX_API_KEY` | [Marketaux](https://www.marketaux.com) | Tickers, sentimiento (MSTR) |
| `ALPHAVANTAGE_API_KEY` | [Alpha Vantage](https://www.alphavantage.co) | Nasdaq, NEWS_SENTIMENT |
| `FINNHUB_API_KEY` | [Finnhub](https://finnhub.io) | Fallback bolsa |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com) | Agente IA de síntesis |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | [@BotFather](https://t.me/BotFather) | Push del brief |

Las fuentes RSS (CoinDesk, Cointelegraph, Decrypt) **no requieren clave** y sirven de
base/fallback. Si una clave falta, esa fuente se omite con un aviso — el run no se rompe.

---

## Comandos

```
news run [--topic <id>] [--all] [--dry-run] [--no-agents]
news list-topics | show-topic <id> | add-topic <id> [--from <template>]
news enable-topic <id> | disable-topic <id>
news sources list | sources test <type> --topic <id>
news agents list | agents enable <id> | agents disable <id> | agents test <id> --topic <id>
news brief latest [--topic <id>] | brief history [--topic <id>] [--limit N]
news schedule install | uninstall | status      # launchd (macOS)
news serve [--port 8730]                         # web UI local
news doctor                                       # diagnóstico completo
```

---

## Extender (cero código en el core)

- **Agregar un tema:** crea `config/briefs/<tema>.yaml` (o `news add-topic <id>`). Listo.
- **Agregar una fuente:** crea `src/sources/<nombre>.js` con el contrato y añádelo a
  `src/sources/index.js`. Sin tocar el core.
- **Agregar/intercambiar un agente:** construye tu agente en cualquier lenguaje (lee
  JSON por stdin, emite JSON por stdout según los schemas en `src/agents/schema/`),
  suelta un manifiesto en `config/agents/manifests/<id>.yaml` y referencialo en el
  `agents:` de cualquier brief. El core nunca importa tu lógica.

Ver detalle del contrato en los comentarios de `src/sources/base-source.js` y
`src/agents/connector.js`.

### Agentes-experto con Claude local (transport `aiox-squad`)

Además del transport `cli` (agente = ejecutable que llama a una API), existe el
transport **`aiox-squad`**: usa **Claude Code local** (`claude -p`, modo headless)
como motor de análisis, con tu **login/suscripción** — **sin `ANTHROPIC_API_KEY`
ni facturación por API**. Cada experto es una *persona + conocimiento* que tú
guardas localmente (estilo `copy-chief`), especializado por tema.

- **Dónde se guarda:** `config/experts/<id>/persona.md` (+ `knowledge/` opcional).
- **Cómo se vincula:** un manifiesto `config/agents/manifests/<id>.yaml` con
  `transport.type: aiox-squad` y `applies_to: ["<tema>"]`.
- **Plantillas:** `config/experts/_template/` y
  `config/agents/manifests/example-expert.yaml.example`.

Guía completa: **`config/experts/README.md`**.

| Transport | Motor | Requiere API key |
|-----------|-------|------------------|
| `cli` | Ejecutable propio (ej. Anthropic API directa) | Según el agente |
| `aiox-squad` | Claude Code local (`claude -p`) | **No** (usa tu suscripción) |
| `http` | Servicio local (loopback/https) | Según el servicio |

---

## Estructura

```
bin/news.js          → entry CLI (ruteo de args)
src/core/            → runner (pipeline), http-client, config-loader, normalizer, dedup
src/sources/         → adaptadores intercambiables (rss, coingecko, marketaux, ...)
src/agents/          → capa pluggable (connector, registry, transports, schemas)
src/notify/          → telegram
src/storage/         → escrituras atómicas, resolución de paths
src/render/          → markdown
agents/ai-synthesizer/ → agente IA de referencia (Anthropic vía fetch, zero-dep)
config/              → settings.yaml, briefs/*.yaml, agents/manifests/*.yaml
docs/news-extractor/ → SALIDA (briefs versionados; data/runs en .gitignore)
```

## Seguridad

Secretos solo por `.env` (gitignored). HTTPS obligatorio (rechaza no-https salvo
loopback). Transport CLI usa `spawn(shell:false)` — sin eval/exec/concatenación. Todo
input externo se valida en `normalizer.js`. El campo `raw` nunca llega al agente ni al
markdown. Correr `/castle-capital-security` antes de merge.
