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

const MAPEO_RESPONSABLES = { 'jchavarro': 'jchavarro-A', 'nvaquiro': 'nvaquiro-A', 'ghincapie': 'ghincapie-A', 'mcastiblanco': 'mcastiblanco-A', 'gguio': 'gguio-A', 'smolina-L': 'smolina-A' };
const MES_NUM = { 'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12 };

(async () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scraper', 'output', 'entregables-2023-diciembre.json'), 'utf8'));
  const anioNum = Number(j.entregables[0]?.anio || 2023);
  const mesNum = MES_NUM[(j.entregables[0]?.mes || '').toLowerCase()] || 12;

  const { data: clientes } = await s.from('clientes').select('id, cliente');
  const { data: usuarios } = await s.from('usuarios').select('id, usuario');
  const { data: tipos } = await s.from('entregable_tipos').select('id, cliente_id, indicador_id, nombre').limit(100000);
  const { data: inds } = await s.from('indicadores').select('id, nombre');
  const IND_PLAN = inds.find((i) => i.nombre.trim().toUpperCase() === 'PLAN DE ENTREGABLES');
  const IND_EXACT = inds.find((i) => i.nombre.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS');
  const clientePorNombre = new Map((clientes || []).map((c) => [(c.cliente || '').trim(), c]));
  const usuarioPorLogin = new Map((usuarios || []).map((u) => [u.usuario, u]));
  const tipoPorClave = new Map((tipos || []).map((t) => [`${t.cliente_id}|${t.indicador_id}|${t.nombre}`, t]));

  const esFecha = (v) => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(String(v || '').trim());
  const esNumero = (v) => /^-?\d+([.,]\d+)?$/.test(String(v || '').trim().replace(/\s/g, ''));

  const jsonPorClave = new Map();
  for (const g of j.entregables) {
    const cliente = clientePorNombre.get((g.cliente || '').trim());
    if (!cliente) continue;
    for (const grupo of g.sub_entregables || []) {
      for (const sub of grupo.filas) {
        const esPlan = esFecha(sub.meta_result);
        const esExact = esNumero(sub.meta_result);
        if (!esPlan && !esExact) continue;
        const indId = esPlan ? IND_PLAN.id : IND_EXACT.id;
        let nombreTipo;
        let usaBase = false;
        if (esPlan) {
          nombreTipo = (sub.entregable || '').trim().replace(/\s+/g, ' ');
        } else {
          const base = grupo.indicador.trim().replace(/\s+/g, ' ');
          const ent = (sub.entregable || '').trim().replace(/\s+/g, ' ');
          if ((ent.toUpperCase() === 'MENSUAL' || ent === '') && tipoPorClave.has(`${cliente.id}|${indId}|${base}`)) {
            nombreTipo = base; usaBase = true;
          } else {
            nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim();
          }
        }
        nombreTipo = nombreTipo.replace(/\s+/g, ' ');
        const respLogin = MAPEO_RESPONSABLES[sub.responsable] || sub.responsable;
        const resp = usuarioPorLogin.get(respLogin);
        if (!resp) continue;
        const clave = `${anioNum}|${mesNum}|${cliente.id}|${indId}|${nombreTipo}|${resp.id}`;
        if (!jsonPorClave.has(clave)) jsonPorClave.set(clave, []);
        jsonPorClave.get(clave).push(sub);
      }
    }
  }

  const { data: bd } = await s.from('entregables').select('tipo, cliente_id, indicador_id, usuario_id').eq('anio', 2023).eq('mes', 12).limit(100000);
  const tipoPorId = new Map((tipos || []).map((t) => [t.id, t]));
  const bdPorClave = new Map();
  for (const e of bd || []) {
    const t = tipoPorId.get(e.tipo);
    const nombre = t ? t.nombre : (e.tipo || '').trim();
    const clave = `${anioNum}|${mesNum}|${e.cliente_id}|${e.indicador_id}|${nombre}|${e.usuario_id}`;
    bdPorClave.set(clave, (bdPorClave.get(clave) || 0) + 1);
  }

  let faltan = 0, clavesFaltan = 0;
  for (const [clave, arr] of jsonPorClave) {
    const nBd = bdPorClave.get(clave) || 0;
    if (arr.length > nBd) {
      clavesFaltan++;
      const extras = arr.length - nBd;
      faltan += extras;
      console.log(`FALTAN ${extras} de ${arr.length} [${clave}]`);
      for (const sub of arr) {
        console.log(`   JSON id=${sub.id} meta_date=${sub.meta_date} meta_number=${sub.meta_number} meta_result=${sub.meta_result} verified=${sub.verified_date}`);
      }
    }
  }
  console.log(`Claves con faltantes: ${clavesFaltan} | Registros faltantes: ${faltan}`);
})();
