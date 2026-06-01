-- ════════════════════════════════════════════════════════════════
-- Migration 003a — Agregar capital_rango (NO destructivo)
-- ════════════════════════════════════════════════════════════════
-- Esta fase es SEGURA: solo agrega la columna `capital_rango` y
-- hace backfill de filas existentes. La columna `capital` original
-- se mantiene viva.
--
-- El frontend pasa a enviar AMBOS campos (capital + capital_rango).
-- Después de confirmar N días sin errores, ejecutar `003b` para
-- borrar la columna `capital` exacta.
-- ════════════════════════════════════════════════════════════════

-- 1. Agregar nueva columna con CHECK constraint
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS capital_rango TEXT
  CHECK (capital_rango IN ('<5M', '5M-20M', '20M-50M', '50M-200M', '200M-1B', '>1B'));

-- 2. Backfill desde la columna exacta para filas existentes
UPDATE prospects
   SET capital_rango = CASE
     WHEN capital < 5000000          THEN '<5M'
     WHEN capital < 20000000         THEN '5M-20M'
     WHEN capital < 50000000         THEN '20M-50M'
     WHEN capital < 200000000        THEN '50M-200M'
     WHEN capital < 1000000000       THEN '200M-1B'
     ELSE '>1B'
   END
 WHERE capital IS NOT NULL
   AND capital_rango IS NULL;

-- Verificación (SQL Editor):
--   SELECT capital_rango, COUNT(*) FROM prospects GROUP BY capital_rango;
--   → debe mostrar la distribución por rangos.
