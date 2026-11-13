const fs = require('fs');
const path = require('path');
const jwt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'jsonwebtoken'));
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
// Admin: buscar id del usuario admin
const { createClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@supabase', 'supabase-js'));
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: admins } = await supa.from('usuarios').select('id,usuario,nombre,rol').eq('rol', 'Admin').limit(3);
  console.log('Admins:', JSON.stringify(admins));
  const adm = admins[0];
  const token = jwt.sign(
    { sub: adm.id, usuario: adm.usuario, nombre: adm.nombre, es_admin: true, cargo_id: null, grupo_id: null, rol: 'Admin' },
    process.env.JWT_SECRET, { expiresIn: '5m' },
  );
  const H = { headers: { Authorization: 'Bearer ' + token } };

  const r1 = await fetch('http://localhost:3000/api/salario-variable-admin/resultados-pago?anio=2026&mes=8', H);
  const j1 = await r1.json();
  console.log('\nADMIN sin filtros: ' + j1.length + ' cards');
  for (const f of j1) console.log(`  ${f.usuario.nombre} (${f.usuario.usuario}, ${f.usuario.rol})${f.caso_especial ? ' [CASO]' : ''}`);

  const r2 = await fetch('http://localhost:3000/api/salario-variable-admin/resultados-pago?anio=2026&mes=8&usuario_id=16', H);
  const j2 = await r2.json();
  console.log('\nADMIN filtrando por Deissy (id 16): ' + j2.length + ' cards');
  for (const f of j2) console.log(`  ${f.usuario.nombre} (${f.usuario.usuario}, ${f.usuario.rol})${f.caso_especial ? ' [CASO]' : ''}`);

  const { data: lideres } = await supa.from('usuarios').select('id,usuario,nombre').eq('rol', 'Lider').eq('activo', true);
  console.log('\nLíderes activos en BD:', lideres.map((l) => `${l.nombre} (${l.usuario})`).join(', '));
})();
