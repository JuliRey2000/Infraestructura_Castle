# Instagram Métricas — Castle Capital

Esta carpeta contiene los reportes semanales de métricas de Instagram de Castle Capital.

## Cómo usar

1. **Sube el archivo de métricas cada semana o quincena.** Formato real en uso:
   `Analisis instagram DD de Mes YYYY.md` (ej: `Analisis instagram 25 de Mayo 2026.md`).
   Instagram entrega la ventana en 30 días rodantes; cada snapshot se compara contra
   el anterior, no contra una semana exacta.

2. **Los agentes leen el archivo** y:
   - Actualizan `scorecard-semanal.md` (sección "Snapshots cargados") con la fila nueva
   - Calculan el Δ vs snapshot anterior
   - Marcan el semáforo
   - Generan `copy-recommendations-YYYY-MM-DD.md` con acciones correctivas

## Qué agentes actúan sobre estos reportes

| Agente | Rol |
|--------|-----|
| `@copy-chief` | Genera copies para posts, stories y reels según métricas |
| `@content-engine` | Planifica calendario de contenido de la semana siguiente |
| `@analyst` | Identifica patrones, tendencias y puntos de mejora |

## Comando de activación

Después de subir el reporte semanal, activa el análisis con:

```
@analyst analiza docs/castle-capital/instagram-metricas/reporte-YYYY-MM-DD.md
y genera recomendaciones de contenido para la semana siguiente
```

O para copies directamente:

```
@copy-chief lee docs/castle-capital/instagram-metricas/reporte-YYYY-MM-DD.md
y propón 5 copies para posts de esta semana basados en lo que mejor funcionó
```

## Estructura de archivos

```
instagram-metricas/
├── README.md                                  ← Este archivo
├── plantilla-reporte.md                       ← Plantilla manual (opcional)
├── scorecard-semanal.md                       ← Fuente de verdad — snapshots + semáforo + acciones
├── Analisis instagram DD de Mes YYYY.md       ← Reporte 30d exportado de IG Insights
└── copy-recommendations-YYYY-MM-DD.md         ← Output del análisis tras cada snapshot
```

## Cadencia recomendada

| Frecuencia | Acción |
|---|---|
| Lunes (10 min) | Llenar columna semanal en `scorecard-semanal.md` con datos manuales del feed |
| Cada 14 días | Subir snapshot 30d de Instagram Insights, actualizar tabla de snapshots, marcar semáforo, generar `copy-recommendations-*` |
| Trigger urgente | Si seguidores Δ=0 por 2 snapshots consecutivas o 3+ rojos en semáforo → activar protocolo de escalada (sección 6 del scorecard) |
