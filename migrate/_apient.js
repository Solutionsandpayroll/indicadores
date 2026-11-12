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
const token = jwt.sign(
  { sub: 1, usuario: 'apitest', nombre: 'apitest', es_admin: true, cargo_id: null, grupo_id: null, rol: 'Admin' },
  process.env.JWT_SECRET, { expiresIn: '5m' },
);
const H = { headers: { Authorization: 'Bearer ' + token } };
(async () => {
  for (const url of [
    'http://localhost:3000/api/entregables/buscar?anio=2025',
    'http://localhost:3000/api/entregables/con-relaciones',
  ]) {
    try {
      const r = await fetch(url, H);
      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.data ?? []);
      console.log(url.split('/api')[1], '=> STATUS', r.status, 'REGISTROS', arr.length);
    } catch (e) { console.log(url.split('/api')[1], 'ERROR:', e.message); }
  }
})();
