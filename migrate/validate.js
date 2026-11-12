/**
 * Modo VALIDACIÓN — cruza el JSON extraído contra la BD y reporta inconsistencias.
 * No inserta nada.
 * Uso: node validate.js [ruta-json]
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@supabase', 'supabase-js'));

function loadEnv() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[m[1]] = val;
  }
}
loadEnv();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const JSON_PATH = process.argv[2] || path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json');

/** Mapeos (deben coincidir con import.js). */
const MAPEO_LIDERES = {
  'tchavarro-L': 'jchavarro', 'nvaquiro-L': 'nvaquiro', 'mcastiblanco-L': 'mcastiblanco',
  'ghincapie-L': 'ghincapie', 'L-rguacaneme': 'rguacaneme-L', 'smolina-LN': 'smolina-L',
};
const MAPEO_RESPONSABLES = {
  'jchavarro': 'jchavarro-A', 'nvaquiro': 'nvaquiro-A', 'ghincapie': 'ghincapie-A',
  'mcastiblanco': 'mcastiblanco-A', 'gguio': 'gguio-A', 'smolina-L': 'smolina-A',
};
/** Distancia de Levenshtein para sugerencias. */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

/** Busca la mejor coincidencia de `nombre` en una lista. */
function sugerir(nombre, lista) {
  let mejor = null, mejorDist = Infinity;
  for (const item of lista) {
    const d = levenshtein(nombre.toLowerCase(), item.toLowerCase());
    if (d < mejorDist) { mejorDist = d; mejor = item; }
  }
  return { nombre: mejor, distancia: mejorDist };
}

function normalizarFecha(v, anioPorDefecto) {
  if (!v) return null;
  // Caso especial: "025/06/202" (día con 0 inicial y año truncado)
  let s = typeof v === 'string' ? v.trim() : v;
  const m0 = s.match(/^0(\d{2}\/\d{2}\/\d{2,4})$/);
  if (m0) s = m0[1];
  // dd/mm/yyyy o d/m/yy o d/m/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return { ok: false, valor: s };
  let [, d, mes, anio] = m;
  if (anio.length === 2) anio = '20' + anio;
  if (anio.length === 3) anio = String(anioPorDefecto || 2026);
  if (anio.length !== 4) return { ok: false, valor: s, razon: 'año inválido' };
  const dd = d.padStart(2, '0'), mm = mes.padStart(2, '0');
  return { ok: true, valor: `${anio}-${mm}-${dd}` };
}

function esFecha(v) {
  // dd/mm/yyyy, d/m/yy, d/m/yyyy, y también casos raros como "025/06/202"
  return /^\d{1,3}\/\d{1,2}\/\d{2,4}$/.test(v || '');
}
function esNumerico(v) {
  return /^[\d.,]+$/.test(v || '');
}

(async () => {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const generales = data.entregables || [];

  // Cargar datos de la BD
  const [clientesRes, usuariosRes, asignacionesRes, indsRes] = await Promise.all([
    supabase.from('clientes').select('id, cliente'),
    supabase.from('usuarios').select('id, usuario, nombre, rol'),
    supabase.from('usuario_clientes').select('usuario_id, cliente_id, rol'),
    supabase.from('indicadores').select('id, nombre'),
  ]);
  // Tipos con paginación (la BD puede superar las 1000 filas)
  const tipos = [];
  {
    const pageSize = 1000;
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase.from('entregable_tipos')
        .select('id, cliente_id, indicador_id, nombre').range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      tipos.push(...(data || []));
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }
  const clientes = clientesRes.data || [];
  const usuarios = usuariosRes.data || [];
  const asignaciones = asignacionesRes.data || [];
  const indicadores = indsRes.data || [];

  const IND_PLAN = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'PLAN DE ENTREGABLES');
  const IND_EXACT = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS');

  const clientePorNombre = new Map(clientes.map((c) => [(c.cliente || '').trim(), c]));
  const usuarioPorLogin = new Map(usuarios.map((u) => [u.usuario, u]));
  const porNombre = new Map();
  for (const u of usuarios) {
    const k = (u.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k).push(u);
  }
  const buscarPorNombre = (nombre) => {
    const arr = porNombre.get((nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase());
    if (!arr) return null;
    return arr.find((u) => u.rol === 'Lider') || arr[0];
  };
  // Resuelve el login real del líder; si cae en la cuenta genérica Admin, usa el nombre del JSON.
  const resolverLiderLogin = (login, nombreLider) => {
    let loginReal = login;
    let user = null;
    if (MAPEO_LIDERES[login] && usuarioPorLogin.has(MAPEO_LIDERES[login])) {
      loginReal = MAPEO_LIDERES[login];
      user = usuarioPorLogin.get(loginReal);
    } else if (usuarioPorLogin.has(login)) {
      user = usuarioPorLogin.get(login);
    }
    if (user?.rol === 'Admin' && nombreLider) {
      const porNom = buscarPorNombre(nombreLider);
      if (porNom) return porNom.usuario;
    }
    return loginReal;
  };
  const asignacionesPorCliente = new Map();
  for (const a of asignaciones) {
    if (!asignacionesPorCliente.has(a.cliente_id)) asignacionesPorCliente.set(a.cliente_id, new Set());
    asignacionesPorCliente.get(a.cliente_id).add(a.usuario_id);
  }
  const tipoExistente = new Set(tipos.map((t) => `${t.cliente_id}|${t.indicador_id}|${t.nombre}`));

  const reporte = {
    generales: generales.length,
    subEntregables: 0,
    planes: 0,
    exactitudes: 0,
    clientesNoEncontrados: new Map(),
    usuariosNoEncontrados: new Map(),
    liderNoAsignado: new Map(),
    fechasRaras: [],
    tiposNuevos: new Set(),
    tiposExistentes: 0,
    nombresLargos: [],
    posiblesDuplicados: [],
    rolesConflicto: [],
    errores: [],
  };

  for (const g of generales) {
    // Cliente del general
    const cliente = clientePorNombre.get((g.cliente || '').trim());
    if (!cliente) {
      const s = sugerir(g.cliente, clientes.map((c) => c.cliente));
      reporte.clientesNoEncontrados.set(g.cliente, s);
    }

    for (const grupo of g.sub_entregables || []) {
      for (const s of grupo.filas) {
        reporte.subEntregables++;
        const tipo = esFecha(s.meta_result) ? 'PLAN' : esNumerico(s.meta_result) ? 'EXACTITUD' : 'DESCONOCIDO';
        if (tipo === 'PLAN') reporte.planes++;
        else if (tipo === 'EXACTITUD') reporte.exactitudes++;
        else reporte.errores.push({ id: s.id, motivo: `meta_result no reconocible: "${s.meta_result}"`, general: g.id });

        // Fechas (solo aplica a PLAN; EXACTITUD usa cantidades)
        if (tipo === 'PLAN') {
          const metaDate = s.meta_date ? normalizarFecha(s.meta_date, Number(g.anio)) : { ok: true, valor: null };
          const metaResult = normalizarFecha(s.meta_result, Number(g.anio));
          if (!metaDate.ok) reporte.fechasRaras.push({ id: s.id, campo: 'meta_date', valor: s.meta_date, general: g.id });
          if (!metaResult.ok) reporte.fechasRaras.push({ id: s.id, campo: 'meta_result', valor: s.meta_result, general: g.id });
        }

        // Usuarios
        if (!usuarioPorLogin.has(s.responsable)) {
          const sug = sugerir(s.responsable, usuarios.map((u) => u.usuario));
          reporte.usuariosNoEncontrados.set(s.responsable, { ...sug, rol: 'responsable' });
        }
        if (!usuarioPorLogin.has(s.verified_user)) {
          const sug = sugerir(s.verified_user, usuarios.map((u) => u.usuario));
          reporte.usuariosNoEncontrados.set(s.verified_user, { ...sug, rol: 'verificado/líder' });
        }

        // Verificación de roles (responsable debe ser Analista, líder debe ser Líder)
        const respReal = MAPEO_RESPONSABLES[s.responsable] || s.responsable;
        const respUser = usuarioPorLogin.get(respReal);
        if (respUser && respUser.rol !== 'Analista') {
          reporte.rolesConflicto.push({ tipo: 'responsable', login: s.responsable, loginReal: respReal, rol: respUser.rol, general: g.id, sub: s.id });
        }
        const lidReal = resolverLiderLogin(s.verified_user, g.lider);
        const lidUser = usuarioPorLogin.get(lidReal);
        if (lidUser && lidUser.rol !== 'Lider') {
          reporte.rolesConflicto.push({ tipo: 'líder', login: s.verified_user, loginReal: lidReal, rol: lidUser.rol, general: g.id, sub: s.id });
        }

        // Líder asignado al cliente (con mapeo)
        if (cliente) {
          const lidReal = resolverLiderLogin(s.verified_user, g.lider);
          const lidUser = usuarioPorLogin.get(lidReal);
          if (lidUser) {
            const asig = asignacionesPorCliente.get(cliente.id);
            if (!asig || !asig.has(lidUser.id)) {
              const key = `${cliente.cliente} ← ${lidReal}`;
              reporte.liderNoAsignado.set(key, { cliente: cliente.cliente, lider: lidReal });
            }
          }
        }

        // Tipo de entregable (Opción A: MENSUAL reutiliza la base si existe)
        if (cliente) {
          const indId = tipo === 'PLAN' ? IND_PLAN?.id : IND_EXACT?.id;
          let nombreTipo;
          let usaBase = false;
          if (tipo === 'PLAN') {
            nombreTipo = s.entregable;
          } else {
            const base = grupo.indicador.trim().replace(/\s+/g, ' ');
            const ent = s.entregable.trim().replace(/\s+/g, ' ');
            if ((ent.toUpperCase() === 'MENSUAL' || ent === '') && tipoExistente.has(`${cliente.id}|${indId}|${base}`)) {
              nombreTipo = base;
              usaBase = true;
            } else {
              nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim();
            }
          }
          nombreTipo = nombreTipo.replace(/\s+/g, ' ');
          if (nombreTipo.length > 100) {
            reporte.nombresLargos.push({ cliente: cliente.cliente, tipo, nombre: nombreTipo, longitud: nombreTipo.length });
          }
          if (indId) {
            const clave = `${cliente.id}|${indId}|${nombreTipo}`;
            if (usaBase || tipoExistente.has(clave)) reporte.tiposExistentes++;
            else {
              reporte.tiposNuevos.add(`${cliente.cliente} | ${tipo} | ${nombreTipo}`);
              // Casos especiales a revisar: QUINCENA/vacío cuya base ya existe
              if (tipo === 'EXACTITUD') {
                const base = grupo.indicador.trim().replace(/\s+/g, ' ');
                if (tipoExistente.has(`${cliente.id}|${indId}|${base}`)) {
                  reporte.posiblesDuplicados.push({
                    cliente: cliente.cliente, tipo, existente: base, propuesto: nombreTipo,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // ── Imprimir reporte ──
  console.log('══════════════════════════════════════════');
  console.log(' REPORTE DE VALIDACIÓN (sin insertar)');
  console.log('══════════════════════════════════════════');
  console.log(`Generales: ${reporte.generales}`);
  console.log(`Sub-entregables: ${reporte.subEntregables}`);
  console.log(`  PLAN: ${reporte.planes} | EXACTITUD: ${reporte.exactitudes}`);
  console.log(`Tipos existentes: ${reporte.tiposExistentes} | Tipos nuevos: ${reporte.tiposNuevos.size}`);

  console.log(`\n── CLIENTES NO ENCONTRADOS (${reporte.clientesNoEncontrados.size}) ──`);
  for (const [nombre, sug] of reporte.clientesNoEncontrados) {
    console.log(`  ✗ "${nombre}" → sugerencia: "${sug.nombre}" (dist ${sug.distancia})`);
  }

  console.log(`\n── USUARIOS NO ENCONTRADOS (${reporte.usuariosNoEncontrados.size}) ──`);
  for (const [login, sug] of reporte.usuariosNoEncontrados) {
    console.log(`  ✗ "${login}" (${sug.rol}) → sugerencia: "${sug.nombre}" (dist ${sug.distancia})`);
  }

  console.log(`\n── LÍDER NO ASIGNADO AL CLIENTE (${reporte.liderNoAsignado.size}) ──`);
  for (const [, v] of reporte.liderNoAsignado) {
    console.log(`  ⚠ ${v.cliente} ← líder ${v.lider}`);
  }

  console.log(`\n── FECHAS RARAS (${reporte.fechasRaras.length}) ──`);
  for (const f of reporte.fechasRaras) {
    console.log(`  ⚠ general ${f.general} sub ${f.id}: ${f.campo}="${f.valor}" ${f.razon || ''}`);
  }

  console.log(`\n── ERRORES (${reporte.errores.length}) ──`);
  for (const e of reporte.errores) {
    console.log(`  ✗ general ${e.general} sub ${e.id}: ${e.motivo}`);
  }

  // Tipos nuevos (primeros 40)
  console.log(`\n── TIPOS NUEVOS (primeros 40 de ${reporte.tiposNuevos.size}) ──`);
  [...reporte.tiposNuevos].slice(0, 40).forEach((t) => console.log(`  + ${t}`));

  console.log(`\n── NOMBRES DE TIPO > 100 CARACTERES (${reporte.nombresLargos.length}) ──`);
  for (const n of reporte.nombresLargos) {
    console.log(`  ⚠ ${n.cliente} | ${n.tipo} | "${n.nombre}" (${n.longitud})`);
  }

  console.log(`\n── POSIBLES TIPOS YA EXISTENTES SIN "MENSUAL/QUINCENA" (${reporte.posiblesDuplicados.length}) ──`);
  for (const d of reporte.posiblesDuplicados) {
    console.log(`  ⚠ ${d.cliente} | ${d.tipo} | ya existe "${d.existente}" → se propondría "${d.propuesto}"`);
  }

  // Resumen de conflictos de rol (agrupado por login)
  const rolesPorLogin = new Map();
  for (const r of reporte.rolesConflicto) {
    const key = `${r.tipo}:${r.login}${r.loginReal !== r.login ? ` (mapeado a ${r.loginReal})` : ''} → rol en BD: ${r.rol}`;
    rolesPorLogin.set(key, (rolesPorLogin.get(key) || 0) + 1);
  }
  console.log(`\n── CONFLICTOS DE ROL (${reporte.rolesConflicto.length} ocurrencias, ${rolesPorLogin.size} distintos) ──`);
  for (const [k, v] of rolesPorLogin) {
    console.log(`  ⚠ ${k} (${v} sub-entregables)`);
  }
})();
