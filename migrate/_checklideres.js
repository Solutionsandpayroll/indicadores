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
  const logins = ['mvanegas', 'afonseca', 'lcumbe', 'dpreciado', 'mvanegas-L', 'afonseca-L', 'lcumbe-L'];
  const { data } = await s.from('usuarios').select('id, usuario, nombre, rol').in('usuario', logins);
  console.log('Usuarios encontrados:');
  for (const u of data || []) console.log(`  ${u.usuario} (id ${u.id}) → rol=${u.rol} · ${u.nombre}`);
  const faltan = logins.filter((l) => !(data || []).some((u) => u.usuario === l));
  if (faltan.length) console.log('No existen:', faltan.join(', '));
})();
