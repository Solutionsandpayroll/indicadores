-- =====================================================
-- Fase 3
-- 1) Valor base de mensual a ANUAL (usuario + año)
-- 2) Caso especial de William: 7 usuarios fuente + componentes propios 50/50
-- =====================================================

-- 1) Valores anuales ────────────────────────────────
-- Quedarse con una fila por usuario+año (elimina duplicados por mes)
DELETE FROM salario_variable_valores a
USING salario_variable_valores b
WHERE a.id < b.id
  AND a.usuario_id = b.usuario_id
  AND a.periodo_anio = b.periodo_anio;

-- Retirar dependencia mensual y vigencias (sin función en el nuevo modelo)
ALTER TABLE salario_variable_valores DROP COLUMN IF EXISTS periodo_mes;
ALTER TABLE salario_variable_valores DROP COLUMN IF EXISTS vigencia_desde;
ALTER TABLE salario_variable_valores DROP COLUMN IF EXISTS vigencia_hasta;

-- Unicidad anual por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uq_sv_valores_usuario_anio
  ON salario_variable_valores(usuario_id, periodo_anio);

-- 2) Caso especial de William Romero (usuario_id = 76) ──
-- 7 usuarios fuente + componentes propios (Entregables 50 / Exactitud 50).
UPDATE salario_variable_casos
SET configuracion = '{
  "usuarios_fuente": [50, 69, 16, 23, 56, 34, 27],
  "componentes": [
    { "metrica": "plan", "nombre": "Entregables", "peso": 50 },
    { "metrica": "exactitud", "nombre": "Exactitud Operativa", "peso": 50 }
  ]
}'::jsonb
WHERE usuario_id = 76;
