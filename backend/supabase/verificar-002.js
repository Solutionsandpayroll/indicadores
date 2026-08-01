/**
 * Verifica que la migración 002 quedó aplicada correctamente.
 * Uso:  cd backend && node supabase/verificar-002.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const REQUERIDAS = [
  'indicador_id', 'tipo', 'fecha_compromiso', 'resultado', 'error_interno',
  'error_cliente', 'aprobado', 'actualizado_en', 'terminado_en',
  'aprobado_en', 'aprobado_por_id',
];

(async () => {
  let ok = true;
  const faltantes = [];

  for (const col of REQUERIDAS) {
    const { error } = await db.from('entregables').select(col).limit(1);
    if (error) { faltantes.push(col); ok = false; }
  }

  console.log(faltantes.length
    ? `✗ Faltan columnas en entregables: ${faltantes.join(', ')}`
    : '✓ Columnas de entregables completas');

  // Tabla de historial
  const { error: errHist } = await db.from('entregables_historial').select('id').limit(1);
  console.log(errHist ? `✗ Falta la tabla entregables_historial (${errHist.message})` : '✓ Tabla entregables_historial creada');
  if (errHist) ok = false;

  // Relación entregables → indicadores (la que rompía /buscar)
  const { error: errRel } = await db.from('entregables').select('*, indicadores(nombre)').limit(1);
  console.log(errRel ? `✗ Relación entregables→indicadores no detectada (${errRel.message})` : '✓ Relación entregables→indicadores OK');
  if (errRel) ok = false;

  console.log(ok
    ? '\n✅ Migración 002 aplicada. Reinicia el backend si estaba corriendo.'
    : '\n❌ Migración incompleta: vuelve a ejecutar 002_entregables_seguimiento.sql en el SQL Editor.');
  process.exit(ok ? 0 : 1);
})();
