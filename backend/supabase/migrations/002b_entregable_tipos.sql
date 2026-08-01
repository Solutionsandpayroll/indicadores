-- ============================================================
-- 002b — Catálogo `entregable_tipos` + FK en entregables
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Contexto: 003_entregable_tipos_seed.sql siembra este catálogo y el
-- backend lo consulta (entregable-tipos.service.ts, entregables.service.ts),
-- pero NINGUNA migración lo creaba. En una base nueva, 003 fallaba con:
--   relation "entregable_tipos" does not exist
-- Esta migración cubre ese hueco y debe correr ANTES de 003.
--
-- Idempotente: se puede correr varias veces sin romper.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Catálogo de tipos, por indicador
-- ─────────────────────────────────────────────
-- Las columnas replican exactamente la interfaz EntregableTipo del backend.
CREATE TABLE IF NOT EXISTS entregable_tipos (
  id           SERIAL PRIMARY KEY,
  indicador_id INTEGER NOT NULL REFERENCES indicadores(id),
  nombre       VARCHAR(100) NOT NULL,
  orden        INTEGER NOT NULL DEFAULT 0,
  mostrar      BOOLEAN NOT NULL DEFAULT true,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. Vínculo desde entregables
-- ─────────────────────────────────────────────
-- Se agrega como NULLABLE a propósito: si la tabla ya tiene filas, un
-- NOT NULL directo fallaría. El backend siempre lo envía al crear.
ALTER TABLE entregables
  ADD COLUMN IF NOT EXISTS entregable_tipo_id INTEGER REFERENCES entregable_tipos(id);
