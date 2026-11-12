/**
 * Compara los sub-entregables del JSON con los que YA existen en la BD
 * para detectar duplicados antes de insertar.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@supabase', 'supabase-js'));

function loadEnv() {
  const c = fs.readFileSync(path.join(__dirname, '..', 'backend', '.env'), 'utf8');
  for (const l of c.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Entregables existentes de febrero 2026
  const { data: existentes, error } = await supabase
    .from('entregables')
    .select('id, mes, anio, cliente_id, indicador_id, tipo, entregable_tipo_id, usuario_id, lider_id, fecha_compromiso, cantidad_compromiso')
    .eq('anio', 2026).eq('mes', 2)
    .limit(5000);
  if (error) { console.log('Error:', error.message); return; }
  console.log(`Entregables existentes en BD (febrero 2026): ${existentes.length}`);
  console.log('Muestra:');
  for (const e of existentes.slice(0, 10)) {
    console.log(`  id=${e.id} cliente=${e.cliente_id} ind=${e.indicador_id} tipo="${e.tipo}" resp=${e.usuario_id} lider=${e.lider_id} fecha=${e.fecha_compromiso} cant=${e.cantidad_compromiso}`);
  }

  // Conteo por indicador
  const porInd = {};
  for (const e of existentes) porInd[e.indicador_id] = (porInd[e.indicador_id] || 0) + 1;
  console.log('\nPor indicador:', porInd);

  // JSON
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json'), 'utf8'));
  let jsonPlan = 0, jsonExact = 0;
  j.entregables.forEach((e) => (e.sub_entregables || []).forEach((g) => g.filas.forEach((s) => {
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s.meta_result || '')) jsonPlan++; else jsonExact++;
  })));
  console.log(`\nJSON febrero 2026: PLAN=${jsonPlan}, EXACTITUD=${jsonExact}`);
})();
