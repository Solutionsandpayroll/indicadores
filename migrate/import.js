/**
 * MIGRACIÓN — inserta los sub-entregables del JSON en la BD.
 *
 * Reglas:
 *  - Solo se insertan los SUB-ENTREGABLES (los generales no).
 *  - Tipo: PLAN si meta_result es fecha; EXACTITUD si es numérico.
 *  - Nombre del tipo: PLAN = entregable; EXACTITUD = "INDICADOR + ENTREGABLE".
 *  - Opción A: si EXACTITUD es "MENSUAL" (o vacío) y la base ya existe, se usa la base.
 *  - estatus = Aprobado, aprobado = true.
 *  - creado_en = register_date; terminado_en = aprobado_en = verified_date.
 *  - Mapeo de líderes con sufijo -L que no existen en BD.
 *
 * Uso:
 *   node import.js           → solo valida y reporta (NO inserta)
 *   INSERT=1 node import.js  → inserta realmente
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

const INSERT = process.env.INSERT === '1';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const JSON_PATH = process.argv[2] || path.join(__dirname, '..', 'scraper', 'output', 'entregables-actual.json');

const log = (m) => console.log(`[migrate] ${m}`);

/** Mapeo de líderes del JSON que no existen en BD (confirmado por el usuario). */
const MAPEO_LIDERES = {
  'tchavarro-L': 'jchavarro',
  'nvaquiro-L': 'nvaquiro',
  'mcastiblanco-L': 'mcastiblanco',
  'ghincapie-L': 'ghincapie',
  'L-rguacaneme': 'rguacaneme-L',
  'smolina-LN': 'smolina-L',
  'lgarcia-A': 'lgarcia-L',
  'lgarcias-a': 'lgarcia-L',
  'acorredor': 'acorredor-L',
  'wromero-A': 'wromero-L',
  // 'wromero-L' ahora existe como Líder en la BD (renombrado de wromero-A)
};

/**
 * Mapeo de responsables: líderes que en la herramienta legada también
 * ejecutaban entregables. En la BD se crearon cuentas Analista alternas.
 */
const MAPEO_RESPONSABLES = {
  'jchavarro': 'jchavarro-A',
  'nvaquiro': 'nvaquiro-A',
  'ghincapie': 'ghincapie-A',
  'mcastiblanco': 'mcastiblanco-A',
  'gguio': 'gguio-A',
  'smolina-L': 'smolina-A',
  'wromero': 'wromero-A',
  'jcervantes': 'jcervantes-A',
};

const MES_NUM = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

/** Normaliza fecha dd/mm/yyyy (o variantes) a yyyy-mm-dd.
 *  Si el año viene truncado (3 dígitos), usa el año del mes migrado. */
function normFecha(v, anioPorDefecto) {
  if (!v || !v.trim()) return null;
  let s = v.trim();
  // Caso especial: "025/06/202", "026/06/24", etc. (día con 0 inicial)
  const m0 = s.match(/^0(\d{2}\/\d{2}\/\d{2,4})$/);
  if (m0) s = m0[1];
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return { error: `formato no reconocido: "${s}"` };
  let [, d, mes, anio] = m;
  if (anio.length === 2) anio = '20' + anio;
  if (anio.length === 3) anio = String(anioPorDefecto || 2026);
  if (anio.length !== 4) return { error: `año inválido: "${s}"` };
  return { valor: `${anio}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}` };
}
function esFecha(v) { return /^\d{1,3}\/\d{1,2}\/\d{2,4}$/.test((v || '').trim()); }

/** Convierte "dd/mm/yyyy HH:MM:SS" a ISO "yyyy-mm-ddTHH:MM:SS" para TIMESTAMPTZ. */
function normTimestamp(v) {
  if (!v || !v.trim()) return null;
  const s = v.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, d, mes, anio, h, min, seg] = m;
  return `${anio}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}:${seg}`;
}
function esNumero(v) { return /^[\d.,]+$/.test((v || '').trim()); }
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

/** Carga TODOS los entregables con paginación (Supabase limita a 1000 por consulta). */
async function cargarEntregablesPaginado() {
  const todos = [];
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('entregables')
      .select('anio, mes, cliente_id, indicador_id, tipo, usuario_id, fecha_compromiso, resultado, cantidad_compromiso, resultado_cantidad')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    todos.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return todos;
}

/** Carga TODOS los tipos con paginación (Supabase limita a 1000 por consulta). */
async function cargarTiposPaginado() {
  const todos = [];
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('entregable_tipos')
      .select('id, cliente_id, indicador_id, nombre')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    todos.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return todos;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const generales = data.entregables || [];

  // ── Cargar datos de la BD ──
  const [clientesRes, usuariosRes, estatusRes, indsRes, asigRes] = await Promise.all([
    supabase.from('clientes').select('id, cliente'),
    supabase.from('usuarios').select('id, usuario, nombre, rol'),
    supabase.from('estatus').select('id, descripcion'),
    supabase.from('indicadores').select('id, nombre'),
    supabase.from('usuario_clientes').select('usuario_id, cliente_id, rol'),
  ]);
  const tipos = await cargarTiposPaginado();
  log(`Tipos cargados: ${tipos.length}`);
  const existentes = await cargarEntregablesPaginado();
  log(`Entregables existentes cargados: ${existentes.length}`);
  // Clave de duplicado: anio|mes|cliente|indicador|tipo|responsable|fechas/montos
  const clavesExistentes = new Set(
    existentes.map((e) => `${e.anio}|${e.mes}|${e.cliente_id}|${e.indicador_id}|${(e.tipo || '').trim()}|${e.usuario_id}|${e.fecha_compromiso ?? ''}|${e.resultado ?? ''}|${e.cantidad_compromiso ?? ''}|${e.resultado_cantidad ?? ''}`),
  );
  const clientes = clientesRes.data || [];
  const usuarios = usuariosRes.data || [];
  const estatus = estatusRes.data || [];
  const indicadores = indsRes.data || [];
  const asignaciones = asigRes.data || [];

  const IND_PLAN = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'PLAN DE ENTREGABLES');
  const IND_EXACT = indicadores.find((i) => i.nombre.trim().toUpperCase() === 'EXACTITUD DE CÁLCULOS');
  const EST_APROBADO = estatus.find((e) => e.descripcion.trim().toLowerCase() === 'aprobado');
  if (!IND_PLAN || !IND_EXACT || !EST_APROBADO) {
    log('Faltan indicadores del sistema o estatus Aprobado. Abortando.');
    return;
  }

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
  const tipoPorClave = new Map(tipos.map((t) => [`${t.cliente_id}|${t.indicador_id}|${t.nombre}`, t]));
  const asignaPorCliente = new Map();
  for (const a of asignaciones) {
    if (!asignaPorCliente.has(a.cliente_id)) asignaPorCliente.set(a.cliente_id, new Set());
    asignaPorCliente.get(a.cliente_id).add(a.usuario_id);
  }

  // ── Resolver líder (con mapeo; si cae en la cuenta genérica Admin, usar el nombre del JSON) ──
  function resolverLider(login, nombreLider) {
    // Usuario resuelto por nombre pasa además por el mapa de logins (lgarcias-a → lgarcia-L, etc.).
    const aplicarMapa = (u) => (u && MAPEO_LIDERES[u.usuario] && usuarioPorLogin.has(MAPEO_LIDERES[u.usuario])) ? usuarioPorLogin.get(MAPEO_LIDERES[u.usuario]) : u;
    let user = null;
    let loginReal = login;
    if (MAPEO_LIDERES[login] && usuarioPorLogin.has(MAPEO_LIDERES[login])) {
      loginReal = MAPEO_LIDERES[login];
      user = usuarioPorLogin.get(loginReal);
    } else if (usuarioPorLogin.has(login)) {
      user = usuarioPorLogin.get(login);
    }
    if (!user) {
      // verified_user vacío en la legada: resolver por el nombre del líder del general.
      if (!login && nombreLider) {
        const porNombre = aplicarMapa(buscarPorNombre(nombreLider));
        if (porNombre) return { id: porNombre.id, login: porNombre.usuario, mapeado: true };
      }
      return null;
    }
    if (user.rol === 'Admin' && nombreLider) {
      const porNombre = aplicarMapa(buscarPorNombre(nombreLider));
      if (porNombre) return { id: porNombre.id, login: porNombre.usuario, mapeado: true };
    }
    return { id: user.id, login: loginReal };
  }

  // ── Primera pasada: tipos nuevos a crear ──
  const tiposNuevos = new Map(); // clave -> {cliente_id, indicador_id, nombre}
  const filas = []; // payloads de entregables
  const omitidos = [];
  let nPlanes = 0, nExact = 0, duplicados = 0;

  for (const g of generales) {
    const cliente = clientePorNombre.get((g.cliente || '').trim());
    if (!cliente) { omitidos.push({ general: g.id, motivo: `cliente no encontrado: ${g.cliente}` }); continue; }
    const mesNum = MES_NUM[(g.mes || '').toLowerCase()] || null;
    const anioNum = Number(g.anio);
    if (!mesNum) { omitidos.push({ general: g.id, motivo: `mes no reconocido: ${g.mes}` }); continue; }

    for (const grupo of g.sub_entregables || []) {
      for (const s of grupo.filas) {
        let esPlan = esFecha(s.meta_result);
        let esExact = esNumero(s.meta_result);
        // meta_result vacío en la legada: entregable sin resultado, clasificar por el indicador del grupo.
        if (!esPlan && !esExact && (s.meta_result || '').trim() === '') {
          const ind = (grupo.indicador || '').trim().toUpperCase();
          if (ind.startsWith('PLAN')) esPlan = true; else esExact = true;
        }
        if (!esPlan && !esExact) { omitidos.push({ general: g.id, sub: s.id, motivo: `meta_result no reconocible: "${s.meta_result}"` }); continue; }
        const tipo = esPlan ? 'PLAN' : 'EXACTITUD';
        const indId = esPlan ? IND_PLAN.id : IND_EXACT.id;

        // Nombre del tipo
        let nombreTipo;
        let usaBase = false;
        if (esPlan) {
          nombreTipo = (s.entregable || '').trim().replace(/\s+/g, ' ');
        } else {
          const base = grupo.indicador.trim().replace(/\s+/g, ' ');
          const ent = (s.entregable || '').trim().replace(/\s+/g, ' ');
          if ((ent.toUpperCase() === 'MENSUAL' || ent === '') &&
              tipoPorClave.has(`${cliente.id}|${indId}|${base}`)) {
            nombreTipo = base; usaBase = true;
          } else {
            nombreTipo = `${base} ${ent || 'MENSUAL'}`.trim();
          }
        }
        nombreTipo = nombreTipo.replace(/\s+/g, ' ');

        // Registrar tipo nuevo si hace falta
        const claveTipo = `${cliente.id}|${indId}|${nombreTipo}`;
        if (!usaBase && !tipoPorClave.has(claveTipo)) {
          if (!tiposNuevos.has(claveTipo)) {
            tiposNuevos.set(claveTipo, { cliente_id: cliente.id, indicador_id: indId, nombre: nombreTipo });
          }
        }

        // Usuarios (con mapeo de responsables que son líderes en la BD)
        const respLogin = MAPEO_RESPONSABLES[s.responsable] || s.responsable;
        const resp = usuarioPorLogin.get(respLogin);
        if (!resp) { omitidos.push({ general: g.id, sub: s.id, motivo: `responsable no encontrado: ${s.responsable}` }); continue; }
        const lider = resolverLider(s.verified_user, g.lider);
        if (!lider) { omitidos.push({ general: g.id, sub: s.id, motivo: `líder no encontrado: ${s.verified_user}` }); continue; }

        // Avisar si el líder no está asignado al cliente
        const asig = asignaPorCliente.get(cliente.id);
        if (!asig || !asig.has(lider.id)) {
          omitidos.push({ general: g.id, sub: s.id, motivo: `líder ${lider.login} no asignado al cliente ${cliente.cliente}` });
        }

        // Fechas
        let fechaCompromiso = null, resultado = null, cantidadCompromiso = null, resultadoCantidad = null;
        if (esPlan) {
          const fc = normFecha(s.meta_date, anioNum);
          const rf = normFecha(s.meta_result, anioNum);
          if (fc && fc.error) { omitidos.push({ general: g.id, sub: s.id, motivo: `meta_date ${fc.error}` }); continue; }
          if (rf && rf.error) { omitidos.push({ general: g.id, sub: s.id, motivo: `meta_result ${rf.error}` }); continue; }
          fechaCompromiso = fc ? fc.valor : null;
          resultado = rf ? rf.valor : null;
        } else {
          cantidadCompromiso = num(s.meta_number);
          resultadoCantidad = num(s.meta_result);
        }

        // ¿Ya existe en la BD? (evitar duplicados)
        const claveDup = `${anioNum}|${mesNum}|${cliente.id}|${indId}|${nombreTipo}|${resp.id}|${fechaCompromiso ?? ''}|${resultado ?? ''}|${cantidadCompromiso ?? ''}|${resultadoCantidad ?? ''}`;
        if (clavesExistentes.has(claveDup)) { duplicados++; continue; }
        if (esPlan) nPlanes++; else nExact++;

        filas.push({
          general: g.id, sub: s.id,
          cliente_id: cliente.id, indId, nombreTipo, claveTipo,
          usuario_id: resp.id, lider_id: lider.id,
          mes: mesNum, anio: anioNum,
          fechaCompromiso, resultado, cantidadCompromiso, resultadoCantidad,
          registro: g.register_date, verificado: s.verified_date,
          verificado_por: lider.id,
        });
      }
    }
  }

  // ── Resumen de la simulación ──
  log('══════════════════════════════════════════');
  log(INSERT ? ' MODO INSERCIÓN' : ' MODO SIMULACIÓN (no inserta)');
  log('══════════════════════════════════════════');
  log(`Sub-entregables a insertar: ${filas.length} (PLAN: ${nPlanes}, EXACTITUD: ${nExact})`);
  log(`Duplicados omitidos (ya en BD): ${duplicados}`);
  log(`Tipos nuevos a crear: ${tiposNuevos.size}`);
  log(`Omitidos/avisos: ${omitidos.length}`);
  for (const o of omitidos.slice(0, 20)) {
    log(`  ⚠ general ${o.general} sub ${o.sub || '-'}: ${o.motivo}`);
  }
  if (omitidos.length > 20) log(`  ... y ${omitidos.length - 20} más`);

  if (!INSERT) {
    log('\nSimulación terminada. Para insertar, ejecutá: INSERT=1 node import.js');
    return;
  }

  // ── Insertar tipos nuevos ──
  log('\nInsertando tipos nuevos...');
  const tiposArr = [...tiposNuevos.values()];
  for (let i = 0; i < tiposArr.length; i += 100) {
    const lote = tiposArr.slice(i, i + 100);
    const { error } = await supabase.from('entregable_tipos').insert(lote);
    if (error) { log(`Error insertando tipos: ${error.message}`); return; }
  }
  log(`  ${tiposArr.length} tipos creados.`);

  // Recargar tipos para resolver IDs
  const tiposActualizados = await cargarTiposPaginado();
  log(`Tipos recargados: ${tiposActualizados.length}`);
  const tipoIdPorClave = new Map((tiposActualizados || []).map((t) => [`${t.cliente_id}|${t.indicador_id}|${t.nombre}`, t.id]));

  // ── Insertar entregables ──
  log('\nInsertando entregables...');
  let insertados = 0, fallidos = 0;
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i];
    const tipoId = tipoIdPorClave.get(f.claveTipo);
    if (!tipoId) { fallidos++; log(`  ✗ ${f.general}/${f.sub}: tipo no resuelto`); continue; }

    // Generar código consecutivo
    const { data: codigo, error: errCod } = await supabase.rpc('next_entregable_codigo');
    if (errCod || !codigo) { fallidos++; log(`  ✗ ${f.general}/${f.sub}: error codigo ${errCod?.message}`); continue; }

    const payload = {
      mes: f.mes, anio: f.anio,
      cliente_id: f.cliente_id,
      lider_id: f.lider_id,
      estatus_id: EST_APROBADO.id,
      usuario_id: f.usuario_id,
      indicador_id: f.indId,
      entregable_tipo_id: tipoId,
      es_nuevo_modelo: true,
      aprobado: true,
      fecha_compromiso: f.fechaCompromiso,
      resultado: f.resultado,
      cantidad_compromiso: f.cantidadCompromiso,
      resultado_cantidad: f.resultadoCantidad,
      terminado_en: normTimestamp(f.verificado),
      aprobado_en: normTimestamp(f.verificado),
      aprobado_por_id: f.verificado_por,
      creado_en: normTimestamp(f.registro),
      codigo,
      tipo: f.nombreTipo,
    };
    const { error } = await supabase.from('entregables').insert(payload);
    if (error) { fallidos++; log(`  ✗ ${f.general}/${f.sub}: ${error.message}`); continue; }
    insertados++;
    if (insertados % 50 === 0) log(`  ... ${insertados}/${filas.length}`);
  }

  log(`\n══ Listo! Insertados: ${insertados}, fallidos: ${fallidos} ══`);
})();
