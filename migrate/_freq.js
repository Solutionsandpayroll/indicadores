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
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: clientes } = await supabase.from('clientes').select('id, cliente');
  const { data: tipos } = await supabase.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre');
  const clientePorNombre = new Map((clientes || []).map((c) => [c.cliente, c]));
  const tipoExistente = new Set((tipos || []).map((t) => `${t.cliente_id}|${t.indicador_id}|${t.nombre}`));

  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json'), 'utf8'));
  const IND_EXACT = 36;
  const conteo = {};
  const casos = [];
  j.entregables.forEach((e) => {
    const cliente = clientePorNombre.get(e.cliente);
    (e.sub_entregables || []).forEach((g) => {
      const esNum = /^[\d.,]+$/.test((g.filas[0] || {}).meta_result || '');
      if (!esNum) return;
      g.filas.forEach((s) => {
        const ent = (s.entregable || '').trim().toUpperCase();
        conteo[ent] = (conteo[ent] || 0) + 1;
        if (cliente) {
          const propuesto = `${g.indicador} ${s.entregable}`.trim().replace(/\s+/g, ' ');
          const base = g.indicador.trim();
          if (tipoExistente.has(`${cliente.id}|${IND_EXACT}|${base}`)) {
            casos.push({ frecuencia: ent, cliente: e.cliente, base, propuesto });
          }
        }
      });
    });
  });
  console.log('Frecuencias de EXACTITUD:');
  Object.entries(conteo).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}x ${k}`));
  console.log('\nCasos con base existente, agrupados por frecuencia:');
  const porFreq = {};
  casos.forEach((c) => { porFreq[c.frecuencia] = (porFreq[c.frecuencia] || 0) + 1; });
  Object.entries(porFreq).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}x ${k}`));
})();
