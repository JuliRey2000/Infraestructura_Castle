# Castle Capital Security Agents — Routing

Routing de threats de seguridad a especialistas en `@cyber-chief`. El squad
`cyber-chief` ya existe globalmente (ver agente `cyber-chief` en la lista de
agentes disponibles) con 6 especialistas. Este documento define el mapeo
específico para Castle Capital (DeFi, trading, asesoría financiera).

> **No se crea `squads/castle-capital/`** — el squad cyber-chief es global y
> reusable. Crear un squad parcial sin spec completo violaría el principio
> No Invention (Constitution Artículo IV).

## Routing Matrix

| Threat Type | Specialist | Use Cases Castle Capital |
|-------------|-----------|--------------------------|
| API/Auth vulnerabilities | `@jim-manico` | DeFi API key exposure, JWT issues, OAuth flows en dashboard |
| Active intrusion detection | `@chris-sanders` | Anomalous trading patterns, wallet drains, bot detection |
| Compliance & regulatory | `@omar-santos` | FATF travel rule, OFAC sanctions, AML para clientes DeFi, SAS Colombia |
| Smart contract security | `@tim-mcgrath` | Auditoría de interacciones Uniswap V3, leverage en Revert, integration patterns |
| Forensics & incident response | `@matt-bromiley` | Análisis post-mortem de wallet comprometida, recovery |
| Cryptography review | `@dan-boneh` | Review de schemes custom (rara vez), análisis de signatures |

## Invocation Flow

### Standard Flow

```
User reports issue
  → @castle-chief (triage inicial castle-capital)
  → @cyber-chief *triage (security routing)
  → specialist (deep-dive)
  → resolution + report
```

### Direct Flow (CRITICAL severity)

Si la skill `/castle-capital-security` detecta CRITICAL:

```
Skill execution
  → @cyber-chief *triage with context
  → specialist directly (skip castle-chief)
  → emergency response
```

### Via Hook Block

Si un hook (secrets-scanner, https-enforcer, dependency-audit) bloquea:

```
Hook exit 2 (block)
  → User decides escalation
  → @cyber-chief *triage if pattern repeats
  → specialist for root cause analysis
```

## Specialist Activation

Para invocar un especialista directamente desde `@cyber-chief`:

```
@cyber-chief

*triage
Context: {situation}
Severity: CRITICAL | HIGH | MEDIUM | LOW
Domain: api-auth | intrusion | compliance | smart-contract | forensics | crypto
Files affected: {list}
```

`@cyber-chief` retornará la recomendación de especialista y opcionalmente lo
invocará automáticamente.

## Castle Capital Specific Scenarios

### Scenario 1: Cliente reporta wallet drain

```
1. @cyber-chief *triage severity=CRITICAL domain=intrusion
2. → @chris-sanders: forensic analysis of transaction history
3. → @matt-bromiley: incident response, recovery options
4. → @omar-santos: compliance reporting (si aplica)
```

### Scenario 2: Nueva integración con Uniswap V4

```
1. @cyber-chief *triage severity=HIGH domain=smart-contract
2. → @tim-mcgrath: review de patrones de interacción
3. → @jim-manico: review de exposición de keys en signers
4. Skill /castle-capital-security run scope=defi
```

### Scenario 3: Onboarding cliente nuevo en CCI

```
1. @cyber-chief *triage severity=MEDIUM domain=compliance
2. → @omar-santos: KYC requirements, OFAC screening
3. Documentar en docs/castle-capital/compliance/{cliente}.md
```

### Scenario 4: Hook secrets-scanner bloquea commit

```
1. Investigar root cause:
   - ¿Es false positive? → Agregar a EXCEPTIONS del hook
   - ¿Es secreto real? → Rotar inmediatamente, mover a env var
2. Si patrón se repite (>3 veces semana):
   → @cyber-chief *triage domain=api-auth
   → @jim-manico: revisar workflow de developers
```

## Anti-Patterns

**NO invocar especialista para:**
- Configuración rutinaria (usar `@devops`)
- Code review general (usar `@qa` o coderabbit)
- Decisiones de arquitectura no-security (usar `@architect`)

**NO escalar directamente sin triage:**
- Siempre pasar por `@cyber-chief *triage` primero
- Excepción: CRITICAL detectado por hook automático

## References

- Agent definition: `cyber-chief` (global, ver lista de agentes)
- `.claude/CLAUDE.md` — Castle Capital Security Standards
- `.claude/rules/security-mcp-usage.md` — MCP tools para security
- Skill `/castle-capital-security` — Auditoría 5-fases
- Constitution Artículo II — Agent Authority (delegación)
