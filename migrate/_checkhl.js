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
  const { data: c } = await s.from('clientes').select('id, cliente').eq('id', 1);
  console.log('Cliente 1:', JSON.stringify(c));
  const { data: t } = await s.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre, creado_en')
    .eq('cliente_id', 1).ilike('nombre', '%OPORTUNIDAD%');
  console.log('Tipos de cliente 1 con OPORTUNIDAD:', JSON.stringify(t, null, 2));
})();
