-- =====================================================
-- Fase 1: errores como entidad hija + semántica de procesados
-- =====================================================
-- Cada error es una fila individual (tipo, descripción, corrección, autor).
-- Los contadores de error_interno/error_cliente se DERIVAN de estas filas.
-- resultado_cantidad pasa a significar "cantidad procesada" (no correctos).

CREATE TABLE IF NOT EXISTS entregable_errores (
  id              SERIAL PRIMARY KEY,
  entregable_id   INTEGER NOT NULL REFERENCES entregables(id) ON DELETE CASCADE,
  tipo            VARCHAR(12) NOT NULL CHECK (tipo IN ('interno','cliente')),
  descripcion     TEXT NOT NULL,
  correccion      TEXT,
  registrado_por  INTEGER REFERENCES usuarios(id),
  corregido_por   INTEGER REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entregable_errores_entregable ON entregable_errores(entregable_id);
CREATE INDEX IF NOT EXISTS idx_entregable_errores_tipo ON entregable_errores(entregable_id, tipo);

-- ── Migración de datos de prueba: filas desde los contadores antiguos ──
INSERT INTO entregable_errores (entregable_id, tipo, descripcion, creado_en)
SELECT e.id, 'interno', 'Error interno (migrado de datos de prueba)', e.creado_en
FROM entregables e
CROSS JOIN generate_series(1, COALESCE(e.error_interno, 0)) g
WHERE COALESCE(e.error_interno, 0) > 0;

INSERT INTO entregable_errores (entregable_id, tipo, descripcion, creado_en)
SELECT e.id, 'cliente', 'Error de cliente (migrado de datos de prueba)', e.creado_en
FROM entregables e
CROSS JOIN generate_series(1, COALESCE(e.error_cliente, 0)) g
WHERE COALESCE(e.error_cliente, 0) > 0;

-- ── resultado_cantidad: reinterpretar "correctos" → "procesados" ──
-- En el modelo anterior resultado_cantidad eran los correctos; los errores de
-- cliente eran casos NO correctos. Ahora procesados = correctos + errores_cliente.
UPDATE entregables
SET resultado_cantidad = COALESCE(resultado_cantidad, 0) + COALESCE(error_cliente, 0)
WHERE indicador_id = 36 AND resultado_cantidad IS NOT NULL;

-- ── Eliminar columnas obsoletas ──
ALTER TABLE entregables DROP COLUMN IF EXISTS error_interno;
ALTER TABLE entregables DROP COLUMN IF EXISTS error_cliente;
