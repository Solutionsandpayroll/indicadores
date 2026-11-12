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
  // Existentes de febrero (como check-dups)
  const { data: exFeb } = await supabase.from('entregables')
    .select('anio, mes, cliente_id, indicador_id, tipo, usuario_id')
    .eq('anio', 2026).eq('mes', 2).limit(5000);
  const setFeb = new Set((exFeb || []).map((e) => `${e.anio}|${e.mes}|${e.cliente_id}|${e.indicador_id}|${(e.tipo || '').trim()}|${e.usuario_id}`));

  // Todos los existentes (como import)
  const { data: exAll } = await supabase.from('entregables')
    .select('anio, mes, cliente_id, indicador_id, tipo, usuario_id').limit(20000);
  const setAll = new Set((exAll || []).map((e) => `${e.anio}|${e.mes}|${e.cliente_id}|${e.indicador_id}|${(e.tipo || '').trim()}|${e.usuario_id}`));

  console.log(`Feb: ${exFeb.length}, All: ${exAll.length}, setFeb: ${setFeb.size}, setAll: ${setAll.size}`);

  const { data: clientes } = await supabase.from('clientes').select('id, cliente');
  const { data: usuarios } = await supabase.from('usuarios').select('id, usuario');
  const { data: tipos } = await supabase.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre');
  const clientePorNombre = new Map((clientes || []).map((c) => [c.cliente, c]));
  const usuarioPorLogin = new Map((usuarios || []).map((u) => [u.usuario, u]));
  const tipoSet = new Set((tipos || []).map((t) => `${t.cliente_id}|${t.indicador_id}|${t.nombre}`));

  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json'), 'utf8'));
  let soloFeb = 0, soloAll = 0, ambos = 0, ninguno = 0;
  const ejemplos = [];
  j.entregables.forEach((g) => {
    const cliente = clientePorNombre.get(g.cliente);
    if (!cliente) return;
    const mesNum = MES_NUM[(g.mes || '').toLowerCase()];
    (g.sub_entregables || []).forEach((grupo) => {
      grupo.filas.forEach((s) => {
        const esPlan = esFecha(s.meta_result);
        const indId = esPlan ? 5 : 36;
        let nombreTipo;
        if (esPlan) {
          nombreTipo = (s.entregable || '').trim().replace(/\s+/g, ' ');
        } else {
          const base = grupo.indicador.trim().replace(/\s+/g, ' ');
          const ent = (s.entregable || '').trim().replace(/\s+/g, ' ');
          if ((ent.toUpperCase() === 'MENSUAL' || ent === '') && tipoSet.has(`${cliente.id}|${indId}|${base}`)) nombreTipo = base;
          else nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim();
        }
        const resp = usuarioPorLogin.get(s.responsable);
        if (!resp) return;
        const clave = `${g.anio}|${mesNum}|${cliente.id}|${indId}|${nombreTipo}|${resp.id}`;
        const enFeb = setFeb.has(clave);
        const enAll = setAll.has(clave);
        if (enFeb && enAll) ambos++;
        else if (enFeb && !enAll) { soloFeb++; if (ejemplos.length < 10) ejemplos.push(`SOLO-FEB ${g.id}/${s.id} ${clave}`); }
        else if (!enFeb && enAll) { soloAll++; if (ejemplos.length < 10) ejemplos.push(`SOLO-ALL ${g.id}/${s.id} ${clave}`); }
        else ninguno++;
      });
    });
  });
  console.log(`ambos=${ambos} soloFeb=${soloFeb} soloAll=${soloAll} ninguno=${ninguno}`);
  ejemplos.forEach((e) => console.log('  ' + e));
})();
