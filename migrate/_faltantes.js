/** Lista los existentes de febrero 2026 que NO están en el JSON (se perderían si se borra). */
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
const MES_NUM = { 'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12 };
const esFecha = (v) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test((v || '').trim());

(async () => {
  const { data: exFeb } = await supabase.from('entregables')
    .select('id, anio, mes, cliente_id, indicador_id, tipo, usuario_id')
    .eq('anio', 2026).eq('mes', 2).limit(5000);
  const { data: clientes } = await supabase.from('clientes').select('id, cliente');
  const { data: usuarios } = await supabase.from('usuarios').select('id, usuario');
  const { data: tipos } = await supabase.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre');
  const clientePorId = new Map((clientes || []).map((c) => [c.id, c.cliente]));
  const usuarioPorId = new Map((usuarios || []).map((u) => [u.id, u.usuario]));
  const tipoSet = new Set((tipos || []).map((t) => `${t.cliente_id}|${t.indicador_id}|${t.nombre}`));

  // Claves del JSON
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json'), 'utf8'));
  const clavesJson = new Set();
  const jsonPorCliente = new Map();
  j.entregables.forEach((g) => {
    const c = (clientes || []).find((x) => x.cliente === g.cliente);
    if (!c) return;
    (g.sub_entregables || []).forEach((grupo) => {
      grupo.filas.forEach((s) => {
        const resp = (usuarios || []).find((u) => u.usuario === s.responsable);
        if (!resp) return;
        const esPlan = esFecha(s.meta_result);
        const indId = esPlan ? 5 : 36;
        let nombreTipo;
        if (esPlan) nombreTipo = (s.entregable || '').trim().replace(/\s+/g, ' ');
        else {
          const base = grupo.indicador.trim().replace(/\s+/g, ' ');
          const ent = (s.entregable || '').trim().replace(/\s+/g, ' ');
          if ((ent.toUpperCase() === 'MENSUAL' || ent === '') && tipoSet.has(`${c.id}|${indId}|${base}`)) nombreTipo = base;
          else nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim();
        }
        clavesJson.add(`${g.anio}|${MES_NUM[(g.mes || '').toLowerCase()]}|${c.id}|${indId}|${nombreTipo}|${resp.id}`);
      });
    });
  });

  const faltantes = (exFeb || []).filter((e) => !clavesJson.has(`${e.anio}|${e.mes}|${e.cliente_id}|${e.indicador_id}|${(e.tipo || '').trim()}|${e.usuario_id}`));
  console.log(`Existentes de febrero NO presentes en el JSON: ${faltantes.length}`);
  for (const f of faltantes) {
    console.log(`  id=${f.id} | ${clientePorId.get(f.cliente_id)} | ind=${f.indicador_id} | tipo="${f.tipo}" | resp=${usuarioPorId.get(f.usuario_id)}`);
  }
})();
