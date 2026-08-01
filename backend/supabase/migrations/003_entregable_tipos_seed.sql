-- ============================================================
-- 003 — Catálogo de tipos de entregable
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Contexto: `entregables.entregable_tipo_id` es NOT NULL y referencia
-- `entregable_tipos`, pero ese catálogo estaba vacío, así que era imposible
-- crear un entregable:
--   "null value in column entregable_tipo_id violates not-null constraint"
--
-- El frontend simulaba los tipos con una constante local (TIPOS_BASE) que
-- nunca llegaba a la base. Aquí se siembran de verdad, por indicador.
--
-- Idempotente: se puede correr varias veces sin duplicar.
-- ============================================================

-- Evita duplicados al re-ejecutar y protege la integridad del catálogo:
-- un indicador no puede tener dos tipos con el mismo nombre.
CREATE UNIQUE INDEX IF NOT EXISTS idx_entregable_tipos_unq
  ON entregable_tipos(indicador_id, nombre);

-- ─────────────────────────────────────────────
-- Siembra: 5 tipos genéricos para cada indicador activo
-- ─────────────────────────────────────────────
-- Ajusta o elimina los que no apliquen desde la pestaña
-- "Tipos de entregable" del dashboard.
INSERT INTO entregable_tipos (indicador_id, nombre, orden, mostrar)
SELECT i.id, t.nombre, t.orden, true
FROM indicadores i
CROSS JOIN (VALUES
  ('Mensual',     1),
  ('Quincenal',   2),
  ('Semanal',     3),
  ('Cierre',      4),
  ('Seguimiento', 5)
) AS t(nombre, orden)
WHERE i.mostrar = true
ON CONFLICT (indicador_id, nombre) DO NOTHING;

-- ─────────────────────────────────────────────
-- Índice para el filtro "tipos de este indicador"
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entregable_tipos_indicador
  ON entregable_tipos(indicador_id);

CREATE INDEX IF NOT EXISTS idx_entregables_tipo_id
  ON entregables(entregable_tipo_id);

-- Cuántos tipos quedaron sembrados
SELECT i.nombre AS indicador, count(t.id) AS tipos
FROM indicadores i
LEFT JOIN entregable_tipos t ON t.indicador_id = i.id
GROUP BY i.nombre
ORDER BY i.nombre;
