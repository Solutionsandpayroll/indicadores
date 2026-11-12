/** Borra los entregables insertados por el script con fechas mal interpretadas (id >= 5877). */
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
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { count } = await s.from('entregables').select('*', { count: 'exact', head: true }).gte('id', 5877);
  console.log(`Entregables con id >= 5877: ${count}`);

  const { data, error } = await s.from('entregables').delete().gte('id', 5877).select('id, codigo, tipo');
  if (error) { console.log('Error:', error.message); return; }
  console.log(`Borrados: ${data.length}`);
  console.log('Ejemplos:', data.slice(0, 3).map((d) => `${d.id} ${d.codigo} "${d.tipo}"`));

  // Verificar que quedaron los 3 manuales
  const { data: manuales } = await s.from('entregables').select('id, codigo, tipo').gte('id', 5874).lte('id', 5876);
  console.log('Manuales conservados:', manuales);
})();
