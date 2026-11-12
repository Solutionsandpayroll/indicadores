/** Reasigna los responsables que son líderes a sus cuentas analistas y verifica. */
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

const CAMBIOS = [
  { de: 35, a: 87, nombre: 'jchavarro → jchavarro-A' },
  { de: 56, a: 88, nombre: 'nvaquiro → nvaquiro-A' },
  { de: 26, a: 89, nombre: 'ghincapie → ghincapie-A' },
];

(async () => {
  console.log('=== ANTES ===');
  let totalAntes = 0;
  for (const c of CAMBIOS) {
    const { count } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('usuario_id', c.de);
    console.log(`  ${c.nombre}: ${count}`);
    totalAntes += count;
  }
  console.log(`  Total a corregir: ${totalAntes}`);

  console.log('\n=== APLICANDO ===');
  for (const c of CAMBIOS) {
    const { error } = await s.from('entregables').update({ usuario_id: c.a }).eq('usuario_id', c.de);
    if (error) { console.log(`  ✗ ${c.nombre}: ${error.message}`); continue; }
    console.log(`  ✓ ${c.nombre}`);
  }

  console.log('\n=== DESPUÉS ===');
  let totalDesp = 0;
  for (const c of CAMBIOS) {
    const { count } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('usuario_id', c.de);
    console.log(`  usuario_id=${c.de} (líder) ahora: ${count}`);
    totalDesp += count;
  }
  console.log(`  Total con líder como responsable: ${totalDesp} (esperado 0)`);

  console.log('\n=== VERIFICACIÓN POR CUENTA ANALISTA ===');
  for (const c of CAMBIOS) {
    const { count } = await s.from('entregables').select('*', { count: 'exact', head: true }).eq('usuario_id', c.a);
    console.log(`  usuario_id=${c.a} (analista): ${count}`);
  }

  // Distribución por mes de las cuentas analistas
  console.log('\n=== DISTRIBUCIÓN POR MES (cuentas -A) ===');
  const { data } = await s.from('entregables').select('mes, anio').in('usuario_id', [87, 88, 89]);
  const porMes = {};
  for (const e of data || []) {
    const k = `${e.anio}-${String(e.mes).padStart(2, '0')}`;
    porMes[k] = (porMes[k] || 0) + 1;
  }
  Object.entries(porMes).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));
})();
