/** Lista los pares (cliente, líder) que faltan asignar, para un mes dado. */
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

const MAPEO_LIDERES = { 'tchavarro-L': 'jchavarro', 'nvaquiro-L': 'nvaquiro', 'mcastiblanco-L': 'mcastiblanco', 'ghincapie-L': 'ghincapie', 'L-rguacaneme': 'rguacaneme-L', 'smolina-LN': 'smolina-L' };
const JSON_PATH = process.argv[2] || path.join(__dirname, '..', 'scraper', 'output', 'entregables-2026-junio.json');

(async () => {
  const { data: clientes } = await s.from('clientes').select('id, cliente');
  const { data: usuarios } = await s.from('usuarios').select('id, usuario, nombre, rol');
  const { data: asig } = await s.from('usuario_clientes').select('usuario_id, cliente_id, rol');
  const clientePorNombre = new Map((clientes || []).map((c) => [(c.cliente || '').trim(), c]));
  const usuarioPorLogin = new Map((usuarios || []).map((u) => [u.usuario, u]));
  const porNombre = new Map();
  for (const u of usuarios || []) {
    const k = (u.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(u);
  }
  const buscarPorNombre = (nombre) => {
    const arr = porNombre.get((nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase());
    if (!arr) return null;
    return arr.find((u) => u.rol === 'Lider') || arr[0];
  };
  const asigPorCliente = new Map();
  for (const a of asig || []) {
    if (!asigPorCliente.has(a.cliente_id)) asigPorCliente.set(a.cliente_id, new Set());
    asigPorCliente.get(a.cliente_id).add(a.usuario_id);
  }

  const j = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const pares = new Map(); // "cliente|líder" -> count
  for (const g of j.entregables) {
    const cliente = clientePorNombre.get((g.cliente || '').trim());
    if (!cliente) continue;
    for (const grupo of g.sub_entregables || []) {
      for (const sub of grupo.filas) {
        let liderLogin = sub.verified_user;
        if (MAPEO_LIDERES[liderLogin] && usuarioPorLogin.has(MAPEO_LIDERES[liderLogin])) liderLogin = MAPEO_LIDERES[liderLogin];
        let lider = usuarioPorLogin.get(liderLogin);
        if (lider?.rol === 'Admin' && g.lider) {
          const porNom = buscarPorNombre(g.lider);
          if (porNom) { lider = porNom; liderLogin = porNom.usuario; }
        }
        if (!lider) continue;
        const asigC = asigPorCliente.get(cliente.id);
        if (!asigC || !asigC.has(lider.id)) {
          const key = `${cliente.cliente} ← ${liderLogin}`;
          pares.set(key, (pares.get(key) || 0) + 1);
        }
      }
    }
  }
  console.log(`Pares (cliente ← líder) que faltan asignar: ${pares.size}`);
  for (const [k, v] of pares) console.log(`  ${k}  (${v} sub-entregables)`);
})();
