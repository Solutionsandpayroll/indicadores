/** Verificación final: conteo de febrero 2026 y fechas de los insertados. */
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
  const { count: feb } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('anio', 2026).eq('mes', 2);
  console.log(`Entregables en BD para febrero 2026: ${feb}`);

  const { count: total } = await s.from('entregables').select('*', { count: 'exact', head: true });
  console.log(`Total entregables en BD: ${total}`);

  const { count: conCodigo } = await s.from('entregables').select('*', { count: 'exact', head: true }).not('codigo', 'is', null);
  console.log(`Con código: ${conCodigo}`);

  // Últimos insertados (del script) con sus fechas
  const { data: recientes } = await s.from('entregables')
    .select('codigo, id, tipo, creado_en, terminado_en, aprobado_en')
    .like('codigo', 'E-%')
    .order('id', { ascending: false })
    .limit(8);
  console.log('\nÚltimos insertados (verificar fechas):');
  for (const r of recientes) {
    console.log(`  ${r.codigo} (id ${r.id}) "${r.tipo}" creado=${r.creado_en} term=${r.terminado_en} aprob=${r.aprobado_en}`);
  }
})();
