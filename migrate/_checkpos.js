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
  // Total de tipos
  const { count: total } = await s.from('entregable_tipos').select('*', { count: 'exact', head: true });
  console.log('Total tipos en BD:', total);

  // Simular el orden del catálogo: indicador_id, orden — y ver la posición del 1960
  let pos = null, from = 0, found = false;
  while (!found) {
    const { data } = await s.from('entregable_tipos')
      .select('id, cliente_id, indicador_id, orden, nombre')
      .order('indicador_id').order('orden').order('id')
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const t of data) {
      pos++;
      if (t.id === 1960) { console.log('Posición del tipo 1960 en el orden del catálogo:', pos, JSON.stringify(t)); found = true; break; }
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  // Cuántos tipos tiene HL COLOMBIA (cliente 1)
  const { count: nHl } = await s.from('entregable_tipos').select('*', { count: 'exact', head: true }).eq('cliente_id', 1);
  console.log('Tipos de HL COLOMBIA (cliente 1):', nHl);
})();
