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
  { sub: 16, usuario: 'dpreciado-L', nombre: 'Deissy Preciado', es_admin: false, cargo_id: null, grupo_id: null, rol: 'Lider' },
  process.env.JWT_SECRET, { expiresIn: '5m' },
);
(async () => {
  const casos = [
    ['sin filtro', ''],
    ['CONTINENTAL (id 8)', '&cliente_id=8'],
    ['SAN JORGE (id 41)', '&cliente_id=41'],
  ];
  for (const [label, extra] of casos) {
    const r = await fetch('http://localhost:3000/api/salario-variable-admin/resultados-pago?anio=2026&mes=8' + extra, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const j = await r.json();
    const f = Array.isArray(j) ? j[0] : null;
    if (!f) { console.log(label + ': (vacío)'); continue; }
    console.log(`${label}: Plan ${f.consolidado.plan.cumplidos}/${f.consolidado.plan.evaluados} | Exact ${f.consolidado.exactitud.correctos_total || 0}/${f.consolidado.exactitud.compromiso_total || 0}`);
  }
})();
