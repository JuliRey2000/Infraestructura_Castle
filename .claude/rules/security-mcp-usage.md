# Security MCP Usage — Castle Capital

Reglas específicas para uso de MCP en operaciones de seguridad. Complementa
`.claude/rules/mcp-usage.md` (reglas generales).

## Principio

**No agregar nuevos servidores MCP** para seguridad. Usar los ya disponibles
(EXA via docker-gateway, Context7) y herramientas nativas (Bash para `npm audit`).
Esto evita el bug conocido de Docker MCP secrets (Dec 2025) y reduce superficie
de ataque del propio sistema.

## Tools Disponibles para Security Workflows

### EXA (via docker-gateway) — Threat Intelligence

**Cuándo usar:**
- Buscar CVEs recientes en librerías DeFi (`ethers.js`, `@uniswap/v3-sdk`, Revert SDKs)
- Consultar OWASP updates relevantes a fintech
- Investigar exploits recientes en protocolos DeFi
- Buscar advisories de supply chain attacks en npm

**Patrón de acceso:**
```
mcp__docker-gateway__web_search_exa
```

**Queries ejemplo:**
- `"CVE ethers.js 2025"` — vulnerabilidades reportadas
- `"Uniswap V3 SDK security advisory 2025"` — issues conocidos
- `"npm supply chain attack 2025"` — paquetes comprometidos recientes
- `"OFAC FATF DeFi compliance Colombia 2025"` — actualizaciones regulatorias

### Context7 (via docker-gateway) — Security Library Docs

**Cuándo usar:**
- Consultar mejores prácticas de uso de `crypto`, `ethers.js`, `@noble/*`
- Verificar API correcta para hashing seguro (bcrypt, scrypt, argon2)
- Documentación de OWASP cheat sheets

**Patrón de acceso:**
```
mcp__docker-gateway__resolve-library-id
mcp__docker-gateway__get-library-docs
```

**Ejemplo:**
- `resolve-library-id("ethers")` → `get-library-docs` con topic `"private key management"`
- `resolve-library-id("argon2")` → `get-library-docs` con topic `"password hashing"`

### npm audit (via Bash) — Dependency Scanning

**Cuándo usar:**
- Pre-commit con dependencias modificadas
- Pre-release/pre-deploy obligatorio
- Investigación de paquete sospechoso

**Comandos:**
```bash
# Audit completo, formato JSON parseable
npm audit --audit-level=moderate --json

# Audit production-only (excluye devDependencies)
npm audit --omit=dev --json

# Fix automático (solo cambios non-breaking)
npm audit fix

# Listar paquetes con vulnerabilidades
npm audit --json | jq '.vulnerabilities | keys[]'
```

**Parseo de salida:**
- `severity: "critical"` → BLOCK release, fix inmediato
- `severity: "high"` → WARN, fix antes de merge
- `severity: "moderate"` → registrar deuda técnica
- `severity: "low"` → noted only

## Workflows de Seguridad

### Workflow 1: Auditoría de Dependencias Pre-Release

```
1. Bash: npm audit --audit-level=high --json > audit.json
2. Bash: jq '.metadata.vulnerabilities' audit.json
3. Si critical > 0:
   → EXA: buscar fix/workaround para CVE específico
   → Context7: docs de librería para alternativa
4. Aplicar fix o pin de versión
5. Re-run audit, confirmar 0 critical
```

### Workflow 2: Investigación de Incidente DeFi

```
1. EXA: "exploit {protocol} {date}" — buscar contexto público
2. Context7: docs de librería afectada
3. Bash: grep en código por patrón vulnerable
4. Reportar a @cyber-chief con evidencia
```

### Workflow 3: Compliance Check

```
1. EXA: "FATF travel rule DeFi 2025" — regulación actual
2. EXA: "OFAC sanctions wallet addresses" — listas vigentes
3. Documentar gaps en docs/security/compliance.md
4. Escalar a @omar-santos (especialista compliance)
```

## NO Usar para Security

- **Apify:** scraping no es relevante para security workflows internos
- **Playwright:** browser automation fuera de scope (excepto pen-testing autorizado)
- **desktop-commander para audits:** preferir Bash directo

## Bug Conocido a Considerar

**Docker MCP Secrets Bug (Dec 2025):** EXA funciona porque su key está en
`config.yaml` (no en secret store). Otros MCPs autenticados pueden fallar.
Si necesitas un MCP nuevo con auth, consulta `.claude/rules/mcp-usage.md`
sección "Known Issues".

## Referencias

- `.claude/CLAUDE.md` — Castle Capital Security Standards
- `.claude/rules/mcp-usage.md` — Reglas MCP generales
- `.claude/rules/castle-capital-security-agents.md` — Routing de especialistas
- Skill `/castle-capital-security` — Auditoría completa de 5 fases
