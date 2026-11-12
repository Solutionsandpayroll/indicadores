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
  const { data } = await s.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre')
    .or('nombre.ilike.%QUINCENA 1%,nombre.ilike.%QUINCENA 2%')
    .or('nombre.ilike.%OPORTUNIDAD EN LOS PROCESOS%,nombre.ilike.%LIQUIDACIÓN NÓMINA%');
  for (const t of data || []) console.log(`${t.id} | cliente ${t.cliente_id} | ind ${t.indicador_id} | ${t.nombre}`);
})();
