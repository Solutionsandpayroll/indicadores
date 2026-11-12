-- =====================================================
-- 011 — Código de visualización para entregables
-- Campo `codigo` = orden cronológico legible (E-00001, E-00002, ...)
-- ordenado por año/mes y fecha de registro. El `id` interno queda intacto.
-- =====================================================

-- 1) Columna de visualización
ALTER TABLE entregables
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) UNIQUE;

-- 2) Backfill: asignar códigos al existente en orden cronológico
--    año ASC → mes ASC → creado_en ASC → id ASC
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY anio ASC, mes ASC, creado_en ASC NULLS LAST, id ASC
         ) AS seq
  FROM entregables
)
UPDATE entregables e
   SET codigo = 'E-' || LPAD(ordered.seq::text, 5, '0')
FROM ordered
WHERE e.id = ordered.id
  AND e.codigo IS NULL;

-- 3) Secuencia para nuevos registros
CREATE SEQUENCE IF NOT EXISTS seq_entregables_codigo START 1;
SELECT setval(
  'seq_entregables_codigo',
  GREATEST((SELECT COUNT(*) FROM entregables), 1)
);

-- 4) Función helper para generar el siguiente código
CREATE OR REPLACE FUNCTION next_entregable_codigo()
RETURNS varchar
LANGUAGE sql
AS $$
  SELECT 'E-' || LPAD(nextval('seq_entregables_codigo')::text, 5, '0');
$$;
