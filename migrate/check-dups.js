/**
 * Detecta qué sub-entregables del JSON ya existen en la BD (febrero 2026).
 * Clave de comparación: (cliente_id, indicador_id, tipo, usuario_id)
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
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAPEO_LIDERES = { 'tchavarro-L': 'jchavarro', 'nvaquiro-L': 'nvaquiro', 'mcastiblanco-L': 'mcastiblanco', 'ghincapie-L': 'ghincapie', 'L-rguacaneme': 'rguacaneme-L' };

const MES_NUM = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function esFecha(v) { return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test((v || '').trim()); }

(async () => {
  const { data: existentes } = await supabase
    .from('entregables')
    .select('id, anio, mes, cliente_id, indicador_id, tipo, usuario_id, lider_id')
    .eq('anio', 2026).eq('mes', 2).limit(5000);
  const claveExistente = new Set((existentes || []).map((e) => `${e.anio}|${e.mes}|${e.cliente_id}|${e.indicador_id}|${(e.tipo || '').trim()}|${e.usuario_id}`));
  console.log(`Existentes en BD: ${existentes.length}`);

  const { data: clientes } = await supabase.from('clientes').select('id, cliente');
  const { data: usuarios } = await supabase.from('usuarios').select('id, usuario');
  const { data: tipos } = await supabase.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre');
  const clientePorNombre = new Map((clientes || []).map((c) => [c.cliente, c]));
  const usuarioPorLogin = new Map((usuarios || []).map((u) => [u.usuario, u]));
  const tipoExistente = new Set((tipos || []).map((t) => `${t.cliente_id}|${t.indicador_id}|${t.nombre}`));

  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json'), 'utf8'));
  let dup = 0, nuevos = 0, sinTipo = 0;
  const dupDetalles = [];
  const nuevosDetalles = [];

  j.entregables.forEach((g) => {
    const cliente = clientePorNombre.get(g.cliente);
    if (!cliente) return;
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
          if ((ent.toUpperCase() === 'MENSUAL' || ent === '') && tipoExistente.has(`${cliente.id}|${indId}|${base}`)) {
            nombreTipo = base;
          } else {
            nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim();
          }
        }
        const resp = usuarioPorLogin.get(s.responsable);
        if (!resp) return;
        const clave = `${g.anio}|${MES_NUM[(g.mes || '').toLowerCase()]}|${cliente.id}|${indId}|${nombreTipo}|${resp.id}`;
        if (claveExistente.has(clave)) {
          dup++;
          dupDetalles.push(`${g.id}/${s.id} · ${g.cliente} · ${nombreTipo} · ${s.responsable}`);
        } else {
          nuevos++;
          nuevosDetalles.push(`${g.id}/${s.id} · ${g.cliente} · ${nombreTipo} · ${s.responsable}`);
        }
      });
    });
  });

  console.log(`\nDUPLICADOS (ya en BD): ${dup}`);
  dupDetalles.slice(0, 20).forEach((d) => console.log(`  = ${d}`));
  if (dup > 20) console.log(`  ... y ${dup - 20} más`);

  console.log(`\nNUEVOS (no están en BD): ${nuevos}`);
  nuevosDetalles.slice(0, 20).forEach((d) => console.log(`  + ${d}`));
  if (nuevos > 20) console.log(`  ... y ${nuevos - 20} más`);
})();
