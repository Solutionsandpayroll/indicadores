-- =====================================================
-- Nuevo modelo: Indicadores base + Catálogo por cliente
-- =====================================================
-- 1. Dos indicadores del sistema (Plan de Entregables /
--    Exactitud de Cálculos), protegidos e indelebles.
-- 2. entregable_tipos se convierte en catálogo de conceptos
--    por cliente: cada concepto pertenece a un cliente y a
--    un indicador base.
-- 3. entregables.es_nuevo_modelo distingue los registros
--    nuevos (fórmulas separadas) de los históricos (intactos).

-- 1. Flag de sistema en indicadores
ALTER TABLE indicadores ADD COLUMN es_sistema BOOLEAN NOT NULL DEFAULT false;

-- 2. Marcar PLAN DE ENTREGABLES como indicador del sistema (ya existe)
UPDATE indicadores
   SET es_sistema = true, mostrar = true
 WHERE UPPER(TRIM(nombre)) = 'PLAN DE ENTREGABLES';

-- 3. Crear EXACTITUD DE CÁLCULOS si no existe
INSERT INTO indicadores (nombre, es_sistema, mostrar)
SELECT 'EXACTITUD DE CÁLCULOS', true, true
 WHERE NOT EXISTS (
   SELECT 1 FROM indicadores WHERE UPPER(TRIM(nombre)) = 'EXACTITUD DE CÁLCULOS'
 );

-- 4. entregable_tipos: cliente asociado, estado y auditoría
ALTER TABLE entregable_tipos ADD COLUMN cliente_id INTEGER REFERENCES clientes(id);
ALTER TABLE entregable_tipos ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE entregable_tipos ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_entregable_tipos_cliente ON entregable_tipos(cliente_id);

-- 5. Unicidad nueva: (cliente, indicador, nombre).
--    Los históricos (cliente_id NULL) nunca chocan entre sí
--    y el mismo nombre sí puede repetirse entre clientes.
DROP INDEX IF EXISTS idx_entregable_tipos_unq;
ALTER TABLE entregable_tipos DROP CONSTRAINT IF EXISTS uq_entregable_tipos_indicador_nombre;
CREATE UNIQUE INDEX idx_entregable_tipos_unq ON entregable_tipos(cliente_id, indicador_id, nombre);

-- 6. Flag de nuevo modelo en entregables
ALTER TABLE entregables ADD COLUMN es_nuevo_modelo BOOLEAN NOT NULL DEFAULT false;
