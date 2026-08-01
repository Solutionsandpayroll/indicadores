-- ============================================================
-- 002 — Entregables: columnas faltantes + seguimiento/cumplimiento
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Contexto: la tabla `entregables` en producción quedó SIN las
-- columnas `indicador_id` y `tipo` que sí declara 001_initial_schema.sql.
-- Eso hacía fallar todo POST /api/entregables con:
--   "Could not find the 'indicador_id' column of 'entregables'"
--
-- Este script es idempotente: se puede correr varias veces sin romper.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Columnas que faltaban del diseño original
-- ─────────────────────────────────────────────
ALTER TABLE entregables
  ADD COLUMN IF NOT EXISTS indicador_id INTEGER REFERENCES indicadores(id),
  ADD COLUMN IF NOT EXISTS tipo         VARCHAR(100);

-- ─────────────────────────────────────────────
-- 2. Compromiso y seguimiento
-- ─────────────────────────────────────────────
ALTER TABLE entregables
  -- fecha pactada de entrega — se captura AL CREAR el entregable.
  -- Es la referencia contra la que se mide la puntualidad, por período.
  -- (No se usa clientes.fecha: esa es la fecha de alta del cliente y es fija.)
  ADD COLUMN IF NOT EXISTS fecha_compromiso DATE,
  -- fecha real de entrega del entregable
  ADD COLUMN IF NOT EXISTS resultado      DATE,
  -- cantidad de errores detectados internamente (antes de enviar al cliente)
  ADD COLUMN IF NOT EXISTS error_interno  INTEGER DEFAULT 0 CHECK (error_interno >= 0),
  -- cantidad de errores reportados por el cliente
  ADD COLUMN IF NOT EXISTS error_cliente  INTEGER DEFAULT 0 CHECK (error_cliente >= 0),
  -- marca de aprobación final
  ADD COLUMN IF NOT EXISTS aprobado       BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- 3. Trazabilidad — quién y cuándo movió el registro
-- ─────────────────────────────────────────────
ALTER TABLE entregables
  ADD COLUMN IF NOT EXISTS actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS terminado_en    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprobado_en     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprobado_por_id INTEGER REFERENCES usuarios(id);

-- `actualizado_en` se mantiene solo, sin que el backend tenga que recordarlo
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entregables_actualizado ON entregables;
CREATE TRIGGER trg_entregables_actualizado
  BEFORE UPDATE ON entregables
  FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

-- ─────────────────────────────────────────────
-- 4. Bitácora de cambios de estatus (trazabilidad completa)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entregables_historial (
  id                SERIAL PRIMARY KEY,
  entregable_id     INTEGER NOT NULL REFERENCES entregables(id) ON DELETE CASCADE,
  estatus_anterior  INTEGER REFERENCES estatus(id),
  estatus_nuevo     INTEGER NOT NULL REFERENCES estatus(id),
  pct_avance        NUMERIC(5,2),
  usuario_id        INTEGER REFERENCES usuarios(id),
  nota              TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_entregable ON entregables_historial(entregable_id);

-- Registra automáticamente cada cambio de estatus
CREATE OR REPLACE FUNCTION log_cambio_estatus()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus_id IS DISTINCT FROM OLD.estatus_id THEN
    INSERT INTO entregables_historial (entregable_id, estatus_anterior, estatus_nuevo, pct_avance)
    VALUES (NEW.id, OLD.estatus_id, NEW.estatus_id, NEW.pct_avance);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entregables_historial ON entregables;
CREATE TRIGGER trg_entregables_historial
  AFTER UPDATE ON entregables
  FOR EACH ROW EXECUTE FUNCTION log_cambio_estatus();

-- ─────────────────────────────────────────────
-- 5. Índices para los filtros dinámicos de la pestaña Entregables
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entregables_indicad   ON entregables(indicador_id);
CREATE INDEX IF NOT EXISTS idx_entregables_mes_anio  ON entregables(anio, mes);
CREATE INDEX IF NOT EXISTS idx_entregables_aprobado  ON entregables(aprobado);
-- filtro combinado más frecuente: cliente + período
CREATE INDEX IF NOT EXISTS idx_entregables_cli_per   ON entregables(cliente_id, anio, mes);
