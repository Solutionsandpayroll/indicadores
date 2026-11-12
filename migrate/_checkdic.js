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
  // Conteo por mes para anio 2023
  const { data } = await s.from('entregables').select('mes').eq('anio', 2023).limit(100000);
  const porMes = {};
  for (const r of data || []) porMes[r.mes] = (porMes[r.mes] || 0) + 1;
  console.log('anio=2023 por mes:', JSON.stringify(porMes));
  console.log('Total anio=2023:', (data || []).length);

  // Conteo diciembre con filtros alternativos
  const { count: c1 } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('anio', 2023).eq('mes', 12);
  const { count: c2 } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('anio', 2023).eq('mes', '12');
  console.log('mes=12 (numero):', c1, '| mes="12" (texto):', c2);

  // Tipos de datos de anio/mes en diciembre
  const { data: d } = await s.from('entregables').select('id, anio, mes').eq('anio', 2023).eq('mes', 12).limit(3);
  console.log('Muestra:', JSON.stringify(d));
})();
