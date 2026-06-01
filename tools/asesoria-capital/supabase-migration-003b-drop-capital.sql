-- ════════════════════════════════════════════════════════════════
-- Migration 003b — Drop columna `capital` (DESTRUCTIVO)
-- ════════════════════════════════════════════════════════════════
-- PRE-REQUISITOS antes de correr este script:
--   1. Migration 003a ya ejecutada (capital_rango existe y tiene
--      backfill de filas anteriores).
--   2. Frontend desplegado con `capitalToRange()` activo.
--   3. Confirmado que los inserts de los últimos N días tienen
--      capital_rango poblado (query de verificación abajo).
--   4. Actualizar el frontend para DEJAR DE ENVIAR `capital` en el
--      body del POST de saveProspectAsync (de lo contrario, los
--      inserts fallarán con 400 porque la columna no existe).
--
-- Query de verificación pre-drop:
--   SELECT
--     COUNT(*) AS total,
--     COUNT(capital) AS con_capital_exacto,
--     COUNT(capital_rango) AS con_capital_rango
--   FROM prospects
--   WHERE saved_at > NOW() - INTERVAL '7 days';
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prospects DROP COLUMN capital;

-- Verificación post-drop (SQL Editor):
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'prospects';
--   → la columna `capital` ya no debe aparecer.
