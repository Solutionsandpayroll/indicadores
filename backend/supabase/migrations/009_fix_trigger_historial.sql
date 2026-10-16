-- =====================================================
-- Fase 1 fix: el trigger de historial referenciaba pct_avance (columna eliminada).
-- Recrea log_cambio_estatus sin pct_avance y quita la columna del historial.
-- =====================================================

CREATE OR REPLACE FUNCTION log_cambio_estatus()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus_id IS DISTINCT FROM OLD.estatus_id THEN
    INSERT INTO entregables_historial (entregable_id, estatus_anterior, estatus_nuevo)
    VALUES (NEW.id, OLD.estatus_id, NEW.estatus_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE entregables_historial DROP COLUMN IF EXISTS pct_avance;
