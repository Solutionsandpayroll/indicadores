/** Borra los entregables de un mes. Uso: node delete-mes.js <anio> <mes> */
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

const ANIO = Number(process.argv[2]);
const MES = Number(process.argv[3]);
if (!ANIO || !MES) { console.log('Uso: node delete-mes.js <anio> <mes>'); process.exit(1); }

(async () => {
  const { count: antes } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('anio', ANIO).eq('mes', MES);
  console.log(`Borrando ${antes} entregables de ${MES}/${ANIO}...`);
  const { error } = await s.from('entregables').delete().eq('anio', ANIO).eq('mes', MES);
  if (error) { console.log('ERROR:', error.message); process.exit(1); }
  const { count: despues } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('anio', ANIO).eq('mes', MES);
  console.log(`Restantes: ${despues}`);
})();
