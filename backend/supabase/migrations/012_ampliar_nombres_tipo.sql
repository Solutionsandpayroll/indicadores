-- =====================================================
-- 012 — Ampliar longitud de nombres de tipos de entregable
-- Los nombres construidos (INDICADOR + ENTREGABLE) pueden
-- superar los 100 caracteres del VARCHAR original.
-- =====================================================

ALTER TABLE entregable_tipos ALTER COLUMN nombre TYPE VARCHAR(255);
ALTER TABLE entregables ALTER COLUMN tipo TYPE VARCHAR(255);
