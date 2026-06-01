-- ════════════════════════════════════════════════════════════════
-- Migration 002 — Endurecer RLS de prospects
-- ════════════════════════════════════════════════════════════════
-- Reemplaza WITH CHECK (true) por validación estricta a nivel de DB:
--   - acepta_contacto debe ser true (compliance Ley 1581 de 2012)
--   - nombre con longitud razonable
--   - email y celular con formato si vienen presentes
-- Esto duplica las validaciones del cliente en el backend, donde no se
-- pueden saltar con un POST manual.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "allow_insert_for_anon" ON prospects;

CREATE POLICY "allow_insert_for_anon_consented"
  ON prospects FOR INSERT TO anon
  WITH CHECK (
    acepta_contacto = true
    AND char_length(nombre) BETWEEN 2 AND 120
    AND (email IS NULL OR email ~* '^[^@]+@[^@]+\.[^@]+$')
    AND (celular IS NULL OR celular ~ '^3[0-9]{9}$')
  );

-- Verificación rápida (ejecutar en SQL Editor de Supabase):
--   INSERT INTO prospects (nombre, acepta_contacto) VALUES ('Test', false);
--   → debe fallar con: new row violates row-level security policy
