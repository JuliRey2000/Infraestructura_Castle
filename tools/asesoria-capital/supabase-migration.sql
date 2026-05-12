-- ════════════════════════════════════════════════════════════════
-- Tabla: prospects
-- Datos mínimos de contacto + perfil. NO incluye ingresos, gastos, ni deudas.
-- Conforme a la Ley 1581 de 2012 (Colombia) — Política de Tratamiento de
-- Datos Personales de Castle Capital.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prospects (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  nombre          TEXT        NOT NULL CHECK (char_length(nombre) <= 120),
  email           TEXT        CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  celular         TEXT        CHECK (celular ~ '^3[0-9]{9}$'),
  capital         NUMERIC     CHECK (capital >= 0 AND capital <= 10000000000),
  riesgo          TEXT        CHECK (riesgo IN ('conservador', 'moderado', 'agresivo')),
  experiencia     TEXT        CHECK (experiencia IN ('ninguna', 'basica', 'intermedia')),
  es_cci          BOOLEAN,
  acepta_contacto BOOLEAN     NOT NULL DEFAULT false
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- Anon puede INSERT (prospect guarda sus datos de contacto desde la herramienta)
CREATE POLICY "allow_insert_for_anon"
  ON prospects FOR INSERT TO anon
  WITH CHECK (true);

-- Sin política SELECT para anon → no pueden leer datos de otros prospects.
-- Admin lee directamente desde Supabase Dashboard usando service role key.
