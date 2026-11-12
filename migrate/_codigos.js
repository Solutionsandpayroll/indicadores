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
  const { data } = await s.from('entregables').select('codigo, id').not('codigo', 'is', null).order('codigo', { ascending: false }).limit(5);
  console.log('Últimos códigos:', data.map((d) => `${d.codigo} (id ${d.id})`));
  const { count } = await s.from('entregables').select('*', { count: 'exact', head: true }).not('codigo', 'is', null);
  console.log('Total con código:', count);
  const { count: altos } = await s.from('entregables').select('*', { count: 'exact', head: true }).gte('codigo', 'E-01124');
  console.log('Con código >= E-01124:', altos);
  const { data: minAlto } = await s.from('entregables').select('codigo, id').gte('codigo', 'E-01124').order('codigo', { ascending: true }).limit(3);
  console.log('Primeros de ese rango:', minAlto);

  const { data: listaAltos } = await s.from('entregables')
    .select('codigo, id, tipo, creado_en, terminado_en')
    .gte('codigo', 'E-01124').order('codigo', { ascending: true });
  console.log(`\nListado de los ${listaAltos.length} con código >= E-01124:`);
  for (const a of listaAltos) {
    console.log(`  ${a.codigo} (id ${a.id}) tipo="${a.tipo}" creado=${a.creado_en} term=${a.terminado_en}`);
  }
})();
