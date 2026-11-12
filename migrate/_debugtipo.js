/** Depura los "tipo no resuelto" de enero 2025. */
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
const MAPEO_LIDERES = { 'tchavarro-L': 'jchavarro', 'nvaquiro-L': 'nvaquiro', 'mcastiblanco-L': 'mcastiblanco', 'ghincapie-L': 'ghincapie', 'L-rguacaneme': 'rguacaneme-L' };
const MAPEO_RESPONSABLES = { 'jchavarro': 'jchavarro-A', 'nvaquiro': 'nvaquiro-A', 'ghincapie': 'ghincapie-A' };
const esFecha = (v) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test((v || '').trim());

(async () => {
  const { data: clientes } = await s.from('clientes').select('id, cliente');
  const { data: tipos } = await s.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre');
  const { data: inds } = await s.from('indicadores').select('id, nombre');
  const IND_PLAN = (inds || []).find((i) => i.nombre.trim().toUpperCase() === 'PLAN DE ENTREGABLES')?.id;
  const IND_EXACT = (inds || []).find((i) => i.nombre.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS')?.id;
  const clientePorNombre = new Map((clientes || []).map((c) => [(c.cliente || '').trim(), c]));
  const tipoSet = new Set((tipos || []).map((t) => `${t.cliente_id}|${t.indicador_id}|${t.nombre}`));

  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-2025-enero.json'), 'utf8'));
  const generalesFallidos = ['3.169', '3.177', '3.184', '3.187', '3.190', '3.199', '3.201', '3.207', '3.208', '3.213', '3.221'];

  for (const gid of generalesFallidos) {
    const g = j.entregables.find((e) => e.id === gid);
    if (!g) { console.log(`${gid}: no encontrado`); continue; }
    const cliente = clientePorNombre.get((g.cliente || '').trim());
    if (!cliente) { console.log(`${gid}: cliente no encontrado: "${g.cliente}"`); continue; }
    console.log(`\n=== ${gid} · ${g.cliente} (cliente id ${cliente.id}) ===`);
    for (const grupo of g.sub_entregables || []) {
      for (const s2 of grupo.filas) {
        const esPlan = esFecha(s2.meta_result);
        const indId = esPlan ? IND_PLAN : IND_EXACT;
        let nombreTipo;
        if (esPlan) {
          nombreTipo = (s2.entregable || '').trim().replace(/\s+/g, ' ');
        } else {
          const base = grupo.indicador.trim().replace(/\s+/g, ' ');
          const ent = (s2.entregable || '').trim().replace(/\s+/g, ' ');
          nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim().replace(/\s+/g, ' ');
        }
        const clave = `${cliente.id}|${indId}|${nombreTipo}`;
        const existe = tipoSet.has(clave);
        console.log(`  sub ${s2.id}: tipo="${nombreTipo}" (${esPlan ? 'PLAN' : 'EXACT'}) → ${existe ? 'OK' : 'NO EXISTE'}`);
      }
    }
  }
})();
