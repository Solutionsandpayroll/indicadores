-- =====================================================
-- Resultados de pago: métrica por componente
-- =====================================================
-- Cada fila de salario_variable_config declara qué métrica
-- evalúa: 'plan' | 'exactitud' | 'quejas'. NULL = pendiente
-- (concepto configurado cuya métrica aún no existe).

ALTER TABLE salario_variable_config ADD COLUMN metrica VARCHAR(20);

-- Concepto Quejas en el catálogo
INSERT INTO conceptos (descripcion)
SELECT 'Quejas'
WHERE NOT EXISTS (SELECT 1 FROM conceptos WHERE descripcion = 'Quejas');

-- Mapeo retrocompatible de las configuraciones existentes
UPDATE salario_variable_config SET metrica = 'plan'
WHERE concepto_id IN (SELECT id FROM conceptos WHERE descripcion = 'Entregables');

UPDATE salario_variable_config SET metrica = 'exactitud'
WHERE concepto_id IN (SELECT id FROM conceptos WHERE descripcion = 'Exactitud Operativa (cliente)');

UPDATE salario_variable_config SET metrica = 'quejas'
WHERE concepto_id IN (SELECT id FROM conceptos WHERE descripcion = 'Quejas');
