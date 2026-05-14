# Instagram Métricas — Castle Capital

Esta carpeta contiene los reportes semanales de métricas de Instagram de Castle Capital.

## Cómo usar

1. **Sube el archivo de métricas cada semana** con el formato de nombre:
   `reporte-YYYY-MM-DD.md` (ej: `reporte-2026-05-13.md`)

2. **Los agentes leen el archivo** y generan recomendaciones de copies y guiones
   basadas en el rendimiento real de la cuenta.

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
├── README.md                    ← Este archivo
├── plantilla-reporte.md         ← Plantilla para llenar cada semana
├── reporte-2026-05-13.md        ← Ejemplo de reporte semanal
└── reporte-YYYY-MM-DD.md        ← Reportes subsiguientes
```
