/**
 * Scraper por CDP — lee la pestaña YA ABIERTA con los entregables.
 *
 * 1. Extrae el grid principal (entregables generales) con paginación.
 * 2. Extrae el detalle (sub-entregables por indicador) de cada fila.
 * 3. Guarda todo en JSON.
 *
 * PASOS:
 *   - Abre el navegador con:  --remote-debugging-port=9222 --user-data-dir="RUTA"
 *   - Entra a la herramienta, abre "Entregables Cerrados", filtra mes/año.
 *   - Corre:  node scrape-cdp.js
 *
 * Variables de entorno:
 *   MAX_DETAILS   — máximo de filas a procesar con detalle (default: 5)
 *   ANIO/MES      — para el nombre del archivo de salida
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  cdpUrl: process.env.CDP_URL || 'http://localhost:9222',
  outputDir: path.join(__dirname, 'output'),
  timeout: Number(process.env.TIMEOUT || 60000),
  maxDetails: Number(process.env.MAX_DETAILS || 5),
};

const log = (msg) => console.log(`[scraper] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GRID_ROW_SEL = 'tr[id^="SC_ancor"]';
const DETAIL_ROW_SEL = 'tbody[id*="grid_entregables_client_details"] tr[id^="SC_ancor"]';

let contexts = null;
let gridPage = null;

/** Extrae las filas del grid principal. */
async function extractGrid(frame) {
  return frame.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tr[id^="SC_ancor"]').forEach((tr) => {
      if (tr.closest('tbody[id*="grid_entregables_client_details"]')) return;
      const get = (f) => {
        const el = tr.querySelector(`[id^="id_sc_field_${f}_"]`);
        return el ? el.textContent.trim() : null;
      };
      rows.push({
        id: get('id'), cliente: get('cliente'), mes: get('id_month'),
        anio: get('id_year'), lider: get('lider'), entregables: get('entregables'),
        register_date: get('register_date'), user_id: get('user_id'),
        user_verified: get('user_verified'), date_verified: get('date_verified'),
        comments: get('comments'),
      });
    });
    return rows;
  });
}

/** Extrae los grupos del detalle (sub-entregables con indicador). */
async function extractDetail(frame) {
  return frame.evaluate(() => {
    const grupos = [];
    const tops = document.querySelectorAll('tbody[id^="tbody_grid_entregables_client_details_"][id$="_top"]');
    tops.forEach((top) => {
      const txt = top.textContent;
      const m = txt.match(/Indicador\s*=>\s*(.+)/i);
      const indicador = m ? m[1].trim() : null;
      const rows = [];
      let bot = top.nextElementSibling;
      while (bot && !bot.id.endsWith('_bot')) bot = bot.nextElementSibling;
      if (bot) {
        bot.querySelectorAll('tr[id^="SC_ancor"]').forEach((tr) => {
          const get = (f) => {
            const el = tr.querySelector(`[id^="id_sc_field_${f}_"]`);
            return el ? el.textContent.trim() : null;
          };
          rows.push({
            id: get('id'), entregable: get('id_entregable'),
            meta_number: get('meta_number'), meta_date: get('meta_date'),
            meta_result: get('meta_result'), meta_formula: get('meta_formula'),
            diference: get('diference'), responsable: get('responsable'),
            user_id: get('user_id'), verified_user: get('verified_user'),
            verified_date: get('verified_date'),
          });
        });
      }
      if (rows.length > 0) grupos.push({ indicador, filas: rows });
    });
    return grupos;
  });
}

/** Localiza el frame del grid principal. */
async function findGrid() {
  for (const f of gridPage.frames()) {
    try {
      const n = await f.evaluate(() => document.querySelectorAll('a.css_list_entregable_grid_line').length);
      if (n > 0) return f;
    } catch { /* ignorar */ }
  }
  return null;
}

/** Localiza el frame de detalle (si está abierto y tiene filas). */
async function findDetail() {
  for (const p of contexts[0].pages()) {
    for (const f of p.frames()) {
      if (f.url().includes('grid_entregables_client_details')) {
        try {
          const n = await f.locator('tr[id^="SC_ancor"]').count();
          if (n > 0) return f;
        } catch { /* ignorar */ }
      }
    }
  }
  return null;
}

/** Número de página activa del grid. */
async function getPageNumber(gf) {
  try {
    return await gf.evaluate(() => {
      const el = document.querySelector('.scGridToolbarNavOpen');
      const n = el ? parseInt(el.textContent.trim(), 10) : NaN;
      return Number.isNaN(n) ? 1 : n;
    });
  } catch { return 1; }
}

/** Cantidad total de páginas del grid. */
async function getPageCount(gf) {
  try {
    return await gf.evaluate(() => {
      let max = 1;
      document.querySelectorAll('a.scGridToolbarNav').forEach((a) => {
        const n = parseInt(a.textContent.trim(), 10);
        if (!Number.isNaN(n) && n > max) max = n;
      });
      return max;
    });
  } catch { return 1; }
}

/** Espera hasta que el grid esté disponible de nuevo. */
async function waitForGrid(timeout = CONFIG.timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const gf = await findGrid();
    if (gf) return gf;
    await sleep(1000);
  }
  return null;
}

/** Navega el grid a la página indicada. */
async function goToPage(gf, n, timeout = CONFIG.timeout) {
  const actual = await getPageNumber(gf);
  if (actual === n) return gf;
  const clicked = await gf.evaluate((target) => {
    const links = document.querySelectorAll('a.scGridToolbarNav');
    for (const a of links) {
      if (a.textContent.trim() === String(target)) { a.click(); return true; }
    }
    return false;
  }, n);
  if (!clicked) {
    // Fallback: forward/back repetido
    const direccion = n > actual ? 'forward_bot' : 'back_bot';
    const pasos = Math.abs(n - actual);
    for (let i = 0; i < pasos; i++) {
      const ok = await gf.evaluate((id) => {
        const b = document.querySelector('#' + id);
        if (b && !b.classList.contains('disabled')) { b.click(); return true; }
        return false;
      }, direccion);
      if (!ok) break;
      await sleep(2500);
    }
  }
  // Esperar a que el número de página cambie
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await sleep(1000);
    const actual2 = await getPageNumber(gf);
    if (actual2 === n) return gf;
  }
  return gf;
}

/** Abre el detalle de la fila `rowIndex`, extrae los grupos y vuelve.
 *  - Espera a que la carga inicial se estabilice (la herramienta puede tardar ~15s).
 *  - Al paginar, espera a que el contenido CAMBIE antes de volver a extraer.
 *  - Deduplica por ID de sub-entregable. */
async function extraerDetalleFila(rowIndex) {
  let gf = await findGrid();
  if (!gf) return null;

  const icons = await gf.$$('a.css_list_entregable_grid_line');
  if (!icons[rowIndex]) return null;
  await icons[rowIndex].click();

  // Esperar el detalle
  let detailF = null;
  const startD = Date.now();
  while (Date.now() - startD < CONFIG.timeout) {
    detailF = await findDetail();
    if (detailF) break;
    await sleep(1000);
  }
  if (!detailF) return null;

  const idsVistos = new Set();
  const todosLosGrupos = [];
  const huella = (grupos) => grupos.map((g) => `${g.indicador}:${g.filas.map((f) => f.id).join(',')}`).join('|');
  const registrar = (grupos) => {
    for (const g of grupos) {
      const nuevas = g.filas.filter((f) => !f.id || !idsVistos.has(f.id));
      for (const f of nuevas) if (f.id) idsVistos.add(f.id);
      if (nuevas.length > 0) todosLosGrupos.push({ indicador: g.indicador, filas: nuevas });
    }
  };

  // ── Estabilizar carga inicial: dos lecturas consecutivas iguales ──
  let ultima = [];
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const nd = await findDetail();
    if (nd) detailF = nd;
    const g = await extractDetail(detailF);
    if (g.length > 0 && huella(g) === huella(ultima)) { registrar(g); break; }
    ultima = g;
  }

  // ── Recorrer páginas: click forward y esperar a que el contenido cambie ──
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const antes = huella(await extractDetail(detailF));
    const clicked = await detailF.evaluate(() => {
      const btns = [...document.querySelectorAll('#forward_bot')];
      let any = false;
      for (const b of btns) {
        if (b && !b.classList.contains('disabled')) { b.click(); any = true; }
      }
      return any;
    });
    if (!clicked) break;

    let cambio = false;
    const start = Date.now();
    while (Date.now() - start < CONFIG.timeout) {
      await sleep(1000);
      const nd = await findDetail();
      if (!nd) continue;
      detailF = nd;
      const g = await extractDetail(detailF);
      if (g.length > 0 && huella(g) !== antes) { registrar(g); cambio = true; break; }
    }
    if (!cambio) break;
  }

  // Volver al grid
  try {
    await detailF.evaluate(() => { const b = document.querySelector('#sai_top'); if (b) b.click(); });
  } catch { /* ignorar */ }
  await waitForGrid();

  return todosLosGrupos;
}

(async () => {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  const outputFile = path.join(CONFIG.outputDir, `entregables-${process.env.ANIO || 'actual'}-${(process.env.MES || 'mes').toLowerCase()}.json`);
  const resume = process.env.RESUME === '1' && fs.existsSync(outputFile);

  log(`Conectando a ${CONFIG.cdpUrl}...`);
  let browser;
  try {
    browser = await chromium.connectOverCDP(CONFIG.cdpUrl);
  } catch (e) {
    log('No se pudo conectar. ¿Navegador con --remote-debugging-port=9222?');
    process.exit(1);
  }

  contexts = browser.contexts();
  const pages = contexts[0] ? contexts[0].pages() : [];
  log(`Pestañas: ${pages.length}`);
  for (const p of pages) log(`  - ${p.url()}`);

  let todasLasFilas = [];
  let procesadas = 0;

  // ══ Reanudar desde JSON existente ══
  if (resume) {
    try {
      const prev = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      todasLasFilas = prev.entregables || [];
      procesadas = prev.procesadas || 0;
      log(`Reanudando: ${todasLasFilas.length} filas cargadas, ${procesadas} ya con detalle.`);
    } catch {
      log('No se pudo leer el JSON previo. Empezando de cero.');
    }
  }

  // ══ FASE 1: extraer el grid principal (solo si no se reanuda) ══
  if (!resume) {
    gridPage = null;
    outer:
    for (const p of pages) {
      for (const f of p.frames()) {
        try {
          const n = await f.locator(GRID_ROW_SEL).count();
          if (n > 0) {
            const gridRows = await f.evaluate(() => {
              let c = 0;
              document.querySelectorAll('tr[id^="SC_ancor"]').forEach((tr) => {
                if (!tr.closest('tbody[id*="grid_entregables_client_details"]')) c++;
              });
              return c;
            });
            if (gridRows > 0) { gridPage = p; log(`Grid: ${f.url()}`); break outer; }
          }
        } catch { /* ignorar */ }
      }
    }
    if (!gridPage) {
      log('No se encontró el grid. Deja la pestaña con entregables abiertos.');
      await browser.close();
      return;
    }

    log('══ Fase 1: grid principal ══');
    let pagina = 1;
    const maxPaginas = Number(process.env.MAX_PAGES || 500);
    while (true) {
      let gf = await findGrid();
      if (!gf) break;
      const filas = await extractGrid(gf);
      todasLasFilas.push(...filas);
      log(`Página ${pagina}: ${filas.length} filas (total: ${todasLasFilas.length})`);

      if (pagina >= maxPaginas) break;
      const clicked = await gf.evaluate(() => {
        const b = document.querySelector('#forward_bot');
        if (b && !b.classList.contains('disabled')) { b.click(); return true; }
        return false;
      });
      if (!clicked) break;

      const firstId = filas[0] ? filas[0].id : null;
      const start = Date.now();
      let cambio = false;
      while (Date.now() - start < CONFIG.timeout) {
        await sleep(1000);
        const nf = await findGrid();
        if (nf) {
          const newFilas = await extractGrid(nf);
          if (newFilas[0] && newFilas[0].id !== firstId) { cambio = true; break; }
        }
      }
      if (!cambio) break;
      pagina++;
    }
    log(`Total filas del grid: ${todasLasFilas.length}`);
  }

  // ══ FASE 2: extraer detalles ══
  log(`══ Fase 2: detalles (máx ${CONFIG.maxDetails}, ya procesadas ${procesadas}) ══`);

  // Localizar el grid (necesario para abrir detalles)
  if (!gridPage) {
    outer:
    for (const p of pages) {
      for (const f of p.frames()) {
        try {
          const n = await f.evaluate(() => document.querySelectorAll('a.css_list_entregable_grid_line').length);
          if (n > 0) { gridPage = p; break outer; }
        } catch { /* ignorar */ }
      }
    }
  }
  if (!gridPage) {
    log('No se encontró el grid para abrir detalles.');
    await browser.close();
    return;
  }

  let gf = await findGrid();
  if (gf) await goToPage(gf, 1);

  const totalPaginas = gf ? await getPageCount(gf) : 1;
  log(`Páginas del grid: ${totalPaginas}`);

  let globalIndex = 0;
  for (let p = 1; p <= totalPaginas && procesadas < CONFIG.maxDetails; p++) {
    gf = await findGrid();
    if (!gf) break;
    gf = await goToPage(gf, p);

    const filasPagina = await gf.evaluate(() => document.querySelectorAll('a.css_list_entregable_grid_line').length);
    log(`── Página ${p}: ${filasPagina} filas ──`);

    for (let i = 0; i < filasPagina && procesadas < CONFIG.maxDetails; i++) {
      const idxGlobal = globalIndex;
      globalIndex++;
      if (idxGlobal < procesadas) continue; // ya procesada en un lote anterior

      // Asegurar que seguimos en la página p (el "Volver" regresa a la 1)
      gf = await findGrid();
      if (!gf) break;
      if (await getPageNumber(gf) !== p) gf = await goToPage(gf, p);

      const fila = todasLasFilas[idxGlobal];
      log(`[${idxGlobal + 1}] ${fila ? fila.id + ' · ' + fila.cliente : 'fila ' + i} → abriendo detalle...`);
      const grupos = await extraerDetalleFila(i);
      if (fila) fila.sub_entregables = grupos;
      const nSub = grupos ? grupos.reduce((s, g) => s + g.filas.length, 0) : 0;
      log(`    → ${grupos ? grupos.length : 0} indicador(es), ${nSub} sub-entregable(s)`);

      // Guardado incremental
      fs.writeFileSync(outputFile, JSON.stringify({
        generado_en: new Date().toISOString(),
        total: todasLasFilas.length,
        procesadas: idxGlobal + 1,
        entregables: todasLasFilas,
      }, null, 2), 'utf8');

      procesadas = idxGlobal + 1;
    }
  }

  log(`══ Listo! ${procesadas} filas con detalle. Guardado en ${outputFile} ══`);
  await browser.close();
  log('Desconectado. Tu navegador sigue abierto.');
})();
