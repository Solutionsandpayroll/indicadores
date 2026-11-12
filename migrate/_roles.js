/** Verifica que los usuarios del JSON tengan un rol coherente en la BD:
 *  - responsable debe ser Analista
 *  - verified_user (líder) debe ser Líder
 */
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

const MAPEO_LIDERES = { 'tchavarro-L': 'jchavarro', 'nvaquiro-L': 'nvaquiro', 'mcastiblanco-L': 'mcastiblanco', 'ghincapie-L': 'ghincapie', 'L-rguacaneme': 'rguacaneme-L', 'eletrado-L': 'eletrado-L', 'smolina-LN': 'smolina-L', 'admin': 'dpreciado-L' };
const MAPEO_RESPONSABLES = { 'jchavarro': 'jchavarro-A', 'nvaquiro': 'nvaquiro-A', 'ghincapie': 'ghincapie-A', 'mcastiblanco': 'mcastiblanco-A', 'gguio': 'gguio-A', 'smolina-L': 'smolina-A' };

(async () => {
  const { data: usuarios } = await s.from('usuarios').select('id, usuario, nombre, rol');
  const userByLogin = new Map((usuarios || []).map((u) => [u.usuario, u]));

  const archivos = process.argv.slice(2);
  for (const archivo of archivos) {
    const j = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    const resp = new Map(); // login -> count
    const verif = new Map();
    j.entregables.forEach((g) => (g.sub_entregables || []).forEach((gr) => gr.filas.forEach((s2) => {
      resp.set(s2.responsable, (resp.get(s2.responsable) || 0) + 1);
      verif.set(s2.verified_user, (verif.get(s2.verified_user) || 0) + 1);
    })));

    console.log(`\n=== ${path.basename(archivo)} ===`);
    console.log('Responsables (deben ser Analista):');
    for (const [login, n] of resp) {
      const real = MAPEO_RESPONSABLES[login] || login;
      const u = userByLogin.get(real);
      if (!u) { console.log(`  ✗ ${login} → NO EXISTE (${n} sub) [como responsable]`); continue; }
      if (u.rol !== 'Analista') console.log(`  ⚠ ${login} (→ ${real}) rol en BD: ${u.rol} (${n} sub) ← CONFLICTO como responsable`);
    }
    console.log('Verificados (deben ser Líder):');
    for (const [login, n] of verif) {
      let real = login;
      if (!userByLogin.has(login) && MAPEO_LIDERES[login]) real = MAPEO_LIDERES[login];
      const u = userByLogin.get(real);
      if (!u) { console.log(`  ✗ ${login} → NO EXISTE (${n} sub) [como líder]`); continue; }
      if (u.rol !== 'Lider') console.log(`  ⚠ ${login} → rol en BD: ${u.rol} (${n} sub) ← CONFLICTO como líder`);
    }
  }
})();
