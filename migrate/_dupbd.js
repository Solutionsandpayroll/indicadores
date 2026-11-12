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
  let from = 0;
  const grupos = new Map();
  while (true) {
    const { data } = await s.from('entregables').select('anio, mes, cliente_id, indicador_id, tipo, usuario_id').range(from, from + 9999);
    if (!data || data.length === 0) break;
    for (const e of data) {
      const k = `${e.anio}|${e.mes}|${e.cliente_id}|${e.indicador_id}|${(e.tipo || '').trim()}|${e.usuario_id}`;
      grupos.set(k, (grupos.get(k) || 0) + 1);
    }
    if (data.length < 10000) break;
    from += 10000;
  }
  let dup = 0, extra = 0;
  for (const [, n] of grupos) if (n > 1) { dup++; extra += n - 1; }
  console.log('Claves únicas en BD:', grupos.size);
  console.log('Claves con duplicados:', dup, '| Registros duplicados (extras):', extra);
  console.log('Total registros:', [...grupos.values()].reduce((a, b) => a + b, 0));
})();
