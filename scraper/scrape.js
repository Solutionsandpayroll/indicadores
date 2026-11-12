/**
 * Prueba de concepto — Scraper de entregables (febrero 2026)
 *
 * Uso:
 *   cd scraper
 *   npm install
 *   npx playwright install chromium
 *   node scrape.js
 *
 * El navegador se abre visible: inicia sesión manualmente y el script continúa solo.
 * Usa esperas activas (wait for element) en vez de tiempos fijos.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ════════════════════════════════════════════════════════════
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'https://app.solutionsandpayroll.com/',
  menuUrl: process.env.MENU_URL || 'https://app.solutionsandpayroll.com/menu/',
  mesValue: process.env.MES_VALUE || '2##@@Febrero',
  anio: process.env.ANIO || '2026',
  menuItemId: process.env.MENU_ITEM || 'item_24',
  outputFile: path.join(__dirname, 'output', `entregables-${process.env.ANIO || '2026'}-${process.env.MES || 'febrero'}.json`),
  debugDir: path.join(__dirname, 'output', 'debug'),
  timeout: Number(process.env.TIMEOUT || 60000),
};

const log = (msg) => console.log(`[scraper] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function debugHtml(name, content) {
  try {
    fs.mkdirSync(CONFIG.debugDir, { recursive: true });
    fs.writeFileSync(path.join(CONFIG.debugDir, name), content, 'utf8');
  } catch { /* ignorar */ }
}

/** Espera activamente hasta que aparezca un frame con la URL dada. */
async function waitForFrame(page, urlPart, timeout = CONFIG.timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const f = page.frames().find((fr) => fr.url().includes(urlPart));
    if (f) return f;
    await sleep(500);
  }
  return null;
}

/** Espera activamente hasta que un frame tenga filas de un grid. */
async function waitForGridRows(frame, selector, timeout = CONFIG.timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const n = await frame.locator(selector).count();
      if (n > 0) return n;
    } catch { /* frame recargándose */ }
    await sleep(700);
  }
  return 0;
}

// ════════════════════════════════════════════════════════════
// Lógica principal
// ════════════════════════════════════════════════════════════
(async () => {
  log('Abriendo navegador (inicia sesión manualmente)...');
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeout);
  page.setDefaultNavigationTimeout(CONFIG.timeout);

  await page.goto(CONFIG.baseUrl);

  // ── Login manual: esperar a que desaparezca el campo de contraseña ──
  log('Esperando login manual...');
  try {
    await page.waitForFunction(
      () => !document.querySelector('input[type="password"]'),
      { timeout: 300000 },
    );
    log('Login detectado.');
  } catch {
    log('Aviso: no se detectó fin de login, continuo igual.');
  }
  await sleep(1500);

  // ── Asegurar que estamos en la página del menú ──
  await page.waitForSelector(`#${CONFIG.menuItemId}`, { state: 'visible', timeout: 30000 })
    .catch(async () => {
      log('No se encontró el menú, navegando a /menu/...');
      await page.goto(CONFIG.menuUrl);
      await page.waitForSelector(`#${CONFIG.menuItemId}`, { state: 'visible', timeout: 30000 });
    });

  // ── Abrir "Entregables Cerrados" ──
  log('Abriendo menú "Entregables Cerrados"...');
  await page.click(`#${CONFIG.menuItemId}`);

  // Esperar a que el iframe del grid cargue
  let frame = await waitForFrame(page, 'grid_entregables_clients_closed', 60000);
  if (!frame) {
    log('No apareció el iframe por URL. Listando frames:');
    for (const f of page.frames()) log(`  - ${f.url()}`);
    // fallback: el iframe visible que no sea el principal
    frame = page.frames().find((f) => f !== page.mainFrame()) || null;
  }
  if (!frame) throw new Error('No se encontró el iframe del grid');
  log(`Iframe localizado: ${frame.url()}`);

  // ── Esperar a que el filtro esté listo dentro del iframe ──
  log('Esperando formulario de filtro...');
  await frame.waitForSelector('#SC_id_month', { state: 'visible', timeout: CONFIG.timeout });
  await frame.waitForSelector('#sc_b_pesq_bot', { state: 'visible', timeout: CONFIG.timeout });

  // ── Aplicar filtro mes/año ──
  log(`Aplicando filtro: ${CONFIG.mesValue} / ${CONFIG.anio}...`);
  await frame.selectOption('#SC_id_month', CONFIG.mesValue);
  await frame.fill('#SC_id_year', CONFIG.anio);
  await sleep(300);

  // ── Enviar búsqueda y esperar el grid ──
  log('Enviando búsqueda...');
  await frame.click('#sc_b_pesq_bot');

  // El grid puede recargar el iframe (navegación) o llegar por AJAX.
  // Esperar activamente filas del grid en cualquier frame.
  log('Esperando filas del grid...');
  let gridFrame = null;
  let filasCount = 0;
  const startGrid = Date.now();
  while (Date.now() - startGrid < CONFIG.timeout) {
    for (const f of page.frames()) {
      try {
        const n = await f.locator('tr[id^="SC_ancor"]').count();
        if (n > 0) { gridFrame = f; filasCount = n; break; }
      } catch { /* frame no accesible */ }
    }
    if (gridFrame) break;
    await sleep(1000);
  }

  if (!gridFrame) {
    log('No se encontraron filas del grid. Frames:');
    for (const f of page.frames()) log(`  - ${f.url()}`);
    debugHtml('after-search.html', await page.content().catch(() => ''));
    throw new Error('No se encontraron filas del grid después de la búsqueda');
  }
  log(`Grid encontrado con ${filasCount} filas en: ${gridFrame.url()}`);

  // ── Extraer filas del grid principal ──
  const filas = await gridFrame.evaluate(() => {
    const rows = [];
    document.querySelectorAll('tr[id^="SC_ancor"]').forEach((tr) => {
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
  log(`Filas extraídas: ${filas.length}`);
  debugHtml('grid-rows.json', JSON.stringify(filas, null, 2));

  // ── Guardar resultado parcial ──
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(filas, null, 2), 'utf8');
  log(`Guardado resultado parcial en ${CONFIG.outputFile}`);

  // ── Prueba: abrir detalle de la primera fila ──
  if (filas.length > 0) {
    log('Probando apertura de detalle de la primera fila...');
    try {
      const iconos = await gridFrame.$$('a.css_list_entregable_grid_line');
      log(`Iconos de detalle: ${iconos.length}`);
      if (iconos[0]) {
        await iconos[0].click();

        // Esperar activamente el modal de detalle (en cualquier frame o pestaña)
        let detailFrame = null;
        const startDetail = Date.now();
        while (Date.now() - startDetail < CONFIG.timeout) {
          for (const f of page.frames()) {
            try {
              const n = await f.locator('tbody[id*="grid_entregables_client_details"] tr[id^="SC_ancor"]').count();
              if (n > 0) { detailFrame = f; break; }
            } catch { /* ignorar */ }
          }
          if (detailFrame) break;
          // revisar pestañas nuevas
          for (const p of context.pages()) {
            try {
              const n = await p.locator('tbody[id*="grid_entregables_client_details"] tr[id^="SC_ancor"]').count();
              if (n > 0) { detailFrame = p.mainFrame(); break; }
            } catch { /* ignorar */ }
          }
          if (detailFrame) break;
          await sleep(1000);
        }

        if (detailFrame) {
          const sub = await detailFrame.evaluate(() => {
            const rows = [];
            document.querySelectorAll('tbody[id*="grid_entregables_client_details"] tr[id^="SC_ancor"]').forEach((tr) => {
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
            return rows;
          });
          log(`Sub-entregables del primer registro: ${sub.length}`);
          debugHtml('detail-rows.json', JSON.stringify(sub, null, 2));
        } else {
          log('No se encontró el modal de detalle.');
        }
      }
    } catch (e) {
      log(`Error abriendo detalle: ${e.message}`);
    }
  }

  log('Prueba terminada. Revisa la carpeta output/.');
  log('El navegador se cierra en 10 segundos...');
  await sleep(10000);
  await browser.close();
})();
