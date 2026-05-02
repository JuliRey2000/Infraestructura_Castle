# CRM Castle Capital — Estructura en Notion

> Sistema operativo de relacionamiento para fase Advertise (Hormozi).
> Construido para soportar el marco diario 100×100×100×100×100×100 y el pipeline de venta consultiva (Klaric: el cliente cree que la idea fue suya).

---

## Filosofía del Sistema

El CRM no es un archivador de contactos. Es la memoria operativa de Castle Capital. Cada interacción registrada hoy es la materia prima de la decisión que cierra una venta dentro de 30 días.

**Tres principios de uso:**
1. **Si no está registrado, no existió.** Toda interacción se loguea el mismo día.
2. **El siguiente paso siempre está agendado.** Ningún prospecto queda sin próxima acción.
3. **El sistema es para Julián, no para impresionar.** Mínimo campo necesario, máxima velocidad de captura.

---

## Arquitectura: 6 Bases de Datos

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    [Prospectos] ←──────→ [Interacciones]                │
│         │                                               │
│         ├──→ [Pipeline]                                 │
│         │                                               │
│         ├──→ [Clientes]                                 │
│         │                                               │
│         └──→ [Tareas / Follow-ups]                      │
│                                                         │
│    [Métricas Diarias Hormozi] (tracking 100×100×100)    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Base: PROSPECTOS

**Propósito:** registro único de cualquier persona que entra en el radar de Castle Capital.

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| Nombre | Title | — |
| Foto / Avatar | Files | Opcional, ayuda a recordar caras |
| Temperatura | Select | `Frío` · `Tibio` · `Caliente` · `Cliente` · `Perdido` |
| Origen | Select | `Instagram` · `WhatsApp` · `Referido` · `Reel` · `Lead Magnet PDF` · `Llamada en frío` · `Correo en frío` · `Evento` · `Otro` |
| Referido por | Relation → Prospectos | Para mapear redes |
| Ciudad / País | Text | — |
| Profesión / Negocio | Text | Contexto para hablar su lenguaje |
| Capital estimado | Select | `<$10M` · `$10–50M` · `$50–200M` · `$200M+` · `No sé` |
| Dolor principal | Text | En sus palabras (NO en jerga DeFi si es frío) |
| Producto de interés | Multi-select | `CCI` · `Curso Trading` · `Inversión LP` · `Mentoría` · `No definido` |
| Etapa | Select | `Contactado` · `Conversación inicial` · `Diagnóstico` · `Propuesta` · `Negociación` · `Cerrado-ganado` · `Cerrado-perdido` |
| Score (1-5) | Select | Calidad del lead. 5 = caliente, listo. 1 = lejos. |
| Última interacción | Rollup desde Interacciones | Más reciente |
| Próxima acción | Rollup desde Tareas | Pendiente más cercana |
| Fecha próxima acción | Rollup desde Tareas | Para alertas |
| Notas Klaric | Text largo | Lo que dijo, miedos, creencias, frases textuales |
| WhatsApp | Phone | Link directo `https://wa.me/57...` |
| Instagram | URL | — |
| Correo | Email | — |
| Creado | Created time | — |

### Vistas

1. **Tablero Pipeline** (Kanban por `Etapa`) — vista principal del día
2. **Calientes hoy** (Filter: `Temperatura = Caliente` AND `Próxima acción <= hoy`)
3. **Por temperatura** (Group: `Temperatura`)
4. **Por origen** (Group: `Origen`) — para medir qué canal trae mejores leads
5. **Sin próxima acción** (Filter: `Próxima acción = vacío`) — alarma roja
6. **Tabla maestra** (todo, ordenado por última interacción)

---

## 2. Base: INTERACCIONES

**Propósito:** log cronológico de cada touchpoint. Una interacción = un evento.

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| Resumen | Title | Una línea: "Le mandé reel de la serie 200→20000" |
| Prospecto | Relation → Prospectos | — |
| Fecha | Date | — |
| Canal | Select | `WhatsApp` · `Instagram DM` · `Llamada` · `Correo` · `Presencial` · `Zoom` |
| Tipo | Select | `Mensaje saliente` · `Mensaje entrante` · `Llamada saliente` · `Llamada entrante` · `Reunión` · `Envío de contenido` |
| Duración (min) | Number | Solo llamadas/reuniones |
| Respondió | Checkbox | — |
| Resultado | Select | `Sin respuesta` · `Respuesta tibia` · `Respuesta positiva` · `Avanzó etapa` · `Bloqueo / Objeción` · `Cierre` |
| Objeción detectada | Multi-select | `Precio` · `Tiempo` · `Confianza` · `Riesgo` · `No es prioridad` · `Necesita pareja` · `Otra` |
| Frase textual del prospecto | Text | Oro puro para Klaric — copiar literal |
| Notas | Text | Qué se habló, próximo paso |
| Generó tarea | Relation → Tareas | — |

### Vistas

1. **Hoy** (Filter: `Fecha = hoy`)
2. **Esta semana por canal** (Group: `Canal`, Filter: semana actual)
3. **Objeciones recurrentes** (Filter: `Objeción detectada` no vacío) — patrón para mejorar Grand Slam Offer
4. **Frases textuales** (galería de citas para refinar copy)

---

## 3. Base: PIPELINE (Oportunidades Activas)

**Propósito:** solo prospectos que están en proceso de venta real. Sub-vista enfocada.

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| Oportunidad | Title | "MAFE — CCI primer ticket" |
| Prospecto | Relation → Prospectos | — |
| Producto | Select | `CCI` · `Curso` · `Mentoría` · `Inversión LP` |
| Ticket estimado COP | Number | — |
| Probabilidad % | Number | 10/30/50/70/90 |
| Valor ponderado | Formula | `Ticket × Probabilidad / 100` |
| Etapa | Select | `Diagnóstico` · `Propuesta enviada` · `Objeción activa` · `Esperando decisión` · `Cerrando` · `Ganado` · `Perdido` |
| Fecha estimada cierre | Date | — |
| Bloqueador actual | Text | Qué falta para cerrar |
| Notas estratégicas | Text | Plan Klaric específico |

### Vistas

1. **Kanban por Etapa** — pipeline visual estilo Pipedrive
2. **Forecast del mes** (Filter: `Fecha estimada cierre` mes actual) con suma de `Valor ponderado`
3. **Bloqueadas** (Filter: `Etapa = Objeción activa` OR `Esperando decisión` > 7 días)

---

## 4. Base: CLIENTES

**Propósito:** quien ya pagó. Diferente lenguaje, diferente cuidado, diferente upsell.

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| Nombre | Title | — |
| Prospecto origen | Relation → Prospectos | — |
| Producto contratado | Multi-select | `CCI` · `Curso` · `Mentoría 3 meses` · `Suscripción $15` · `Inversión LP` |
| Capital bajo gestión COP | Number | Solo CCI / mandato |
| Fecha inicio | Date | — |
| Estado mandato | Select | `Activo` · `Pausa` · `Cerrado` |
| Ganancia generada COP | Number | Para fee del 20% |
| NPS / Satisfacción (1-10) | Number | Trimestral |
| Casos de éxito / testimonio | Files | Audio, captura, video |
| Próximo upsell | Text | Curso → Mentoría → CCI |
| Riesgo churn | Select | `Bajo` · `Medio` · `Alto` |
| Notas legales | Text | Mandato firmado, contrato, etc. |

### Vistas

1. **Activos** (Filter: `Estado mandato = Activo`)
2. **Por producto** (Group: `Producto`)
3. **Casos de éxito listos** (Filter: testimonio no vacío AND NPS >= 9)
4. **Riesgo de churn** (Filter: `Riesgo churn = Alto`)

---

## 5. Base: TAREAS / FOLLOW-UPS

**Propósito:** ninguna conversación queda colgada. Todo prospecto tiene próxima acción agendada.

### Campos

| Campo | Tipo | Notas |
|-------|------|-------|
| Acción | Title | "Llamar a MAFE para diagnóstico" |
| Prospecto | Relation → Prospectos | — |
| Tipo | Select | `Mensaje` · `Llamada` · `Correo` · `Enviar contenido` · `Reunión` · `Tarea interna` |
| Prioridad | Select | `Alta` · `Media` · `Baja` |
| Fecha límite | Date | — |
| Hecho | Checkbox | — |
| Resultado al completar | Relation → Interacciones | Genera log automático |

### Vistas

1. **Hoy** (Filter: `Fecha límite = hoy` AND `Hecho = false`) — agenda diaria
2. **Atrasadas** (Filter: `Fecha límite < hoy` AND `Hecho = false`) — alarma
3. **Esta semana** (Filter: semana actual)
4. **Por prospecto** (Group: `Prospecto`)

---

## 6. Base: MÉTRICAS DIARIAS HORMOZI

**Propósito:** tracking del marco 100×100×100×100×100×100. Disciplina visible.

### Campos

| Campo | Tipo | Meta diaria |
|-------|------|-------------|
| Fecha | Date (Title) | — |
| Mensajes enviados | Number | 100 |
| Llamadas hechas | Number | 100 |
| Correos enviados | Number | 100 |
| Leads fríos contactados | Number | 100 |
| Leads calientes trabajados | Number | 100 |
| Minutos de contenido publicado | Number | 100 |
| Reuniones agendadas | Number | — |
| Cierres del día | Number | — |
| Revenue cerrado COP | Number | — |
| Reflexión del día | Text | Qué funcionó, qué no |

### Vistas

1. **Hoy** (entrada rápida)
2. **Últimos 7 días** (tabla con suma)
3. **Mes en curso** (suma de cada métrica vs meta × días)
4. **Gráfico de progreso** (Chart embebido)

---

## Dashboard Principal (Página de Entrada)

Una sola página de Notion con bloques que muestren:

```
┌─────────────────────────────────────────────────────┐
│  CASTLE CAPITAL — COMANDO DE OPERACIONES            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Métricas de Hoy]                                  │
│  Mensajes: 47/100  ████████░░░░                     │
│  Llamadas: 12/100  ██░░░░░░░░░░                     │
│  ...                                                │
│                                                     │
│  [Tareas Hoy]          [Calientes Hoy]              │
│  - Llamar MAFE         - Juan David                 │
│  - DM Yudy             - Profe Arturo               │
│                                                     │
│  [Pipeline en curso] (kanban embebido)              │
│                                                     │
│  [Forecast del mes]                                 │
│  $XX.XXX.XXX COP ponderado                          │
│                                                     │
│  [Clientes activos]                                 │
│  X mandatos · $XXX.XXX.XXX bajo gestión             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Workflow Operativo Diario (15 min mañana / 15 min noche)

### Mañana (antes de prospectar)
1. Abrir dashboard.
2. Revisar **Tareas Hoy** y **Atrasadas**.
3. Mirar **Calientes Hoy** — esos son la prioridad.
4. Confirmar bloque de tiempo para mensajes/llamadas/contenido.

### Durante el día
- Cada interacción → registrar en **Interacciones** (30 segundos).
- Cada nuevo lead → crear en **Prospectos** con próxima acción agendada.
- Cada respuesta importante → copiar frase textual al campo Klaric.

### Noche (cierre del día)
1. Marcar tareas hechas.
2. Llenar **Métricas Diarias Hormozi** (números reales, no aspiracionales).
3. Escribir reflexión: ¿qué patrón vi en las objeciones? ¿qué funcionó?
4. Agendar mínimo 1 acción para cada prospecto sin próxima tarea.

---

## Migración desde lo que ya existe

El archivo `docs/castle-capital/prospectos.md` ya tiene a MAFE, Juan David, Yudy y Profe Arturo. Migrarlos como **primer ejercicio de uso**: si la estructura no soporta esos 4 casos reales, hay que ajustarla antes de seguir.

**Orden de migración:**
1. Crear bases vacías en Notion (1h).
2. Migrar 4 prospectos actuales con su historial Klaric (30min).
3. Generar tareas pendientes para cada uno (15min).
4. Usar el sistema 7 días seguidos.
5. Iterar la estructura con base en fricciones reales (no en suposiciones).

---

## Criterio para construir versión propia (Next.js + Supabase)

Migrar a app custom **solo si** uno o más de estos puntos se cumplen después de 30-60 días:

- Notion se vuelve lento con >500 prospectos
- Necesitas integraciones que Notion no permite (WhatsApp Business API, scraping de Instagram, automatizaciones complejas)
- Quieres dashboards en tiempo real para Camila / equipo futuro
- El dashboard de Castle Capital del repo `aios-core` ya está maduro y se puede integrar como módulo

Hasta entonces: **Notion gana por velocidad de iteración**.

---

## Anexo: Plantillas de Página por Prospecto

Cada prospecto en Notion debería tener una página interna con esta plantilla:

```markdown
## Contexto Klaric
- ¿Qué le duele hoy?
- ¿Qué ya intentó?
- ¿Qué creencia limitante tiene sobre el dinero / inversión?
- ¿Quién decide con él? (pareja, socio, asesor)

## Frases textuales suyas
- "..."
- "..."

## Hipótesis de venta
- Producto adecuado:
- Ticket realista:
- Argumento que más le va a resonar:
- Objeción que probablemente saldrá:

## Plan de avance
- Próximos 3 movimientos:
  1.
  2.
  3.

## Historial
(Auto-poblado desde Interacciones vía relation)
```

---

*Castle Capital — Sistema construido para precisión, no velocidad. La velocidad llega después.*
