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
const mk = (sub, rol, usuario) => jwt.sign(
  { sub, usuario, nombre: usuario, es_admin: rol === 'Admin', cargo_id: null, grupo_id: null, rol },
  process.env.JWT_SECRET, { expiresIn: '5m' },
);
(async () => {
  for (const [label, token] of [
    ['Admin', mk(1, 'Admin', 'admin')],
    ['dpreciado-L', mk(16, 'Lider', 'dpreciado-L')],
  ]) {
    const r = await fetch('http://localhost:3000/api/entregables/resumen-por-cliente?anio=2026&mes=8', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const j = await r.json();
    const total = j.reduce?.((s, x) => s + x.total, 0);
    console.log(`${label}: ${r.status} | ${Array.isArray(j) ? j.length + ' clientes, total=' + total : JSON.stringify(j).slice(0, 100)}`);
    if (Array.isArray(j)) console.log('  top3:', j.slice(0, 3).map((x) => `${x.cliente}(${x.total})`).join(', '));
  }
})();
