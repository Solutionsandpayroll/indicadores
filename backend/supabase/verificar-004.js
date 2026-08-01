/**
 * Verifica que la migración 004 (bitácora de avances) quedó aplicada.
 * Uso:  cd backend && node supabase/verificar-004.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  let ok = true;

  const { error } = await db.from('entregables_avances').select('id').limit(1);
  console.log(error
    ? `✗ Falta la tabla entregables_avances (${error.message})`
    : '✓ Tabla entregables_avances creada');
  if (error) ok = false;

  // Columnas que el backend espera poder escribir
  for (const col of ['entregable_id', 'fecha', 'pct_avance', 'observacion', 'usuario_id']) {
    const { error: e } = await db.from('entregables_avances').select(col).limit(1);
    if (e) { console.log(`✗ Falta la columna ${col}`); ok = false; }
  }
  if (ok) console.log('✓ Columnas completas');

  // La relación con usuarios se usa para mostrar quién registró el avance
  const { error: eRel } = await db
    .from('entregables_avances').select('*, usuarios(nombre)').limit(1);
  console.log(eRel
    ? `✗ Relación entregables_avances→usuarios no detectada (${eRel.message})`
    : '✓ Relación entregables_avances→usuarios OK');
  if (eRel) ok = false;

  console.log(ok
    ? '\n✅ Migración 004 aplicada. Reinicia el backend si estaba corriendo.'
    : '\n❌ Migración incompleta: ejecuta 004_entregables_avances.sql en el SQL Editor.');
  process.exit(ok ? 0 : 1);
})();
