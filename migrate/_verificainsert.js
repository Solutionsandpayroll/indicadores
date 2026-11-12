/** Revisa los entregables insertados por el script (codigo E-*, creado_en reciente). */
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
  const { data, error } = await supabase
    .from('entregables')
    .select('id, codigo, tipo, creado_en, terminado_en, aprobado_en, anio, mes')
    .like('codigo', 'E-%')
    .order('id', { ascending: false })
    .limit(120);
  if (error) { console.log('Error:', error.message); return; }
  // Los insertados por el script tienen ids altos (después de 1123)
  const recientes = (data || []).filter((e) => e.id > 1123);
  console.log(`Con codigo E-*: ${data.length}; con id > 1123: ${recientes.length}`);
  for (const e of recientes.slice(0, 20)) {
    console.log(`  id=${e.id} cod=${e.codigo} tipo="${e.tipo}" creado=${e.creado_en} term=${e.terminado_en} aprob=${e.aprobado_en}`);
  }
})();
