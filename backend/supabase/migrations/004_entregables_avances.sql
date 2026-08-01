-- ============================================================
-- 004 — Bitácora de avances de entregables
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Permite registrar el avance de un entregable a lo largo del tiempo
-- (fecha, % y observación) en vez de solo guardar el último número.
-- `entregables.pct_avance` queda como espejo del avance más reciente.
--
-- Idempotente: se puede correr varias veces sin romper.
-- ============================================================

CREATE TABLE IF NOT EXISTS entregables_avances (
  id            SERIAL PRIMARY KEY,
  entregable_id INTEGER NOT NULL REFERENCES entregables(id) ON DELETE CASCADE,
  fecha         DATE NOT NULL DEFAULT CURRENT_DATE,
  pct_avance    NUMERIC(5,2) NOT NULL CHECK (pct_avance BETWEEN 0 AND 100),
  observacion   TEXT,
  -- quién registró el avance (trazabilidad)
  usuario_id    INTEGER REFERENCES usuarios(id),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El panel siempre pide "los avances de este entregable, más reciente primero".
CREATE INDEX IF NOT EXISTS idx_avances_entregable
  ON entregables_avances(entregable_id, fecha DESC, id DESC);
