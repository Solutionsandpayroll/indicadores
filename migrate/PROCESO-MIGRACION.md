# Proceso de migración de entregables (mes a mes)

Guía para migrar los entregables históricos de la herramienta legada a la nueva aplicación, **un mes a la vez**.

---

## Requisitos previos

- Node.js 20+ instalado.
- Backend con las migraciones aplicadas (al menos `011_entregable_codigo.sql` y `012_ampliar_nombres_tipo.sql`).
- Acceso a la herramienta legada (`https://app.solutionsandpayroll.com/`).
- El backend NO hace falta que esté corriendo para la extracción (el scraper lee el navegador).

---

## Flujo general

```
1. Abrir navegador en modo depuración
2. Entrar a la herramienta y dejar el listado del mes abierto
3. Extraer el JSON          → node scrape-cdp.js
4. Validar contra la BD     → node validate.js
5. Importar a la BD         → node import.js  (simulación)
6. Importar de verdad       → INSERT=1 node import.js
7. Verificar en la app
```

---

## Paso 1 — Abrir el navegador en modo depuración

**Cerrá TODAS las ventanas de Chrome/Edge** y abrí con:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\TU_USUARIO\chrome-debug"
```

> Si usás Edge:
> ```powershell
> & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\TU_USUARIO\chrome-debug"
> ```

El `--user-data-dir` es obligatorio en Chrome moderno (sin él no abre el puerto de depuración).

---

## Paso 2 — Entrar a la herramienta y dejar el listado abierto

En esa ventana:

1. Entrá a `https://app.solutionsandpayroll.com/` e **iniciá sesión**.
2. Menú **Archivo → Entregables Cerrados**.
3. En el filtro, elegí el **Mes** y el **Año** (ej. Marzo 2026) y tocá **Búsqueda**.
4. **Dejá la pestaña con el listado visible** (no la cierres).

---

## Paso 3 — Extraer el JSON

En una terminal nueva:

```powershell
cd scraper
$env:ANIO="2026"; $env:MES="Marzo"; $env:MAX_DETAILS="20"; node scrape-cdp.js
```

| Variable | Descripción | Ejemplo |
|---|---|---|
| `ANIO` | Año del mes a migrar | `2026` |
| `MES` | Nombre del mes (para el archivo) | `Marzo` |
| `MAX_DETAILS` | Máximo de filas a procesar con detalle (total acumulado) | `20`, `80`, `500`... |

**Importante:** `MAX_DETAILS` es el total acumulado, no el adicional. Para procesar todo el mes, usá un número alto (ej. `1000`). Para probar, empezá con `20`.

El script:
- Recorre **todas las páginas** del grid.
- Abre el detalle de cada fila y extrae los sub-entregables.
- Guarda en `scraper/output/entregables-2026-marzo.json`.
- Es **reanudable**: si usás `RESUME=1`, salta las filas ya procesadas (guardadas en el JSON).

```powershell
# Para continuar donde quedó (si Chrome se cuelga):
$env:ANIO="2026"; $env:MES="Marzo"; $env:MAX_DETAILS="1000"; $env:RESUME="1"; node scrape-cdp.js
```

---

## Paso 4 — Validar contra la BD

```powershell
cd migrate
node validate.js ../scraper/output/entregables-2026-marzo.json
```

Revisá el reporte:
- **Clientes no encontrados**: si hay, o los creás o los corregís.
- **Usuarios no encontrados**: si hay leaders con sufijo `-L` que no existen, se agregan al mapeo en `import.js`.
- **Fechas raras**: se normalizan (año 2026).
- **Tipos nuevos**: cuántos se crearían.

Si el reporte está limpio, continuá.

---

## Paso 5 — Importar (simulación primero)

```powershell
node import.js ../scraper/output/entregables-2026-marzo.json
```

Esto **NO inserta nada**: solo muestra cuántos insertaría, cuántos duplicados omitiría y cuántos tipos crearía.

---

## Paso 6 — Importar de verdad

```powershell
$env:INSERT="1"; node import.js ../scraper/output/entregables-2026-marzo.json
```

El script:
1. Crea los tipos nuevos (si no existen).
2. Inserta los entregables con:
   - `estatus = Aprobado`, `aprobado = true`
   - `creado_en` = `register_date`, `terminado_en` = `aprobado_en` = `verified_date`
   - Código `E-*` generado automáticamente.
3. **Omite automáticamente los duplicados** (compara `año|mes|cliente|indicador|tipo|responsable` contra la BD).

Es **idempotente**: si lo volvés a correr, solo inserta los que faltan.

---

## Paso 7 — Verificar

En la app, entrá a **Entregables** y filtrá por el mes migrado. Verificá:
- Que los entregables se vean.
- Que los % Cumple y Impacto variable estén correctos.
- Que los códigos `E-*` se vean en la columna "Código".

---

## Notas importantes

### Límites de Supabase
- Las consultas devuelven **máximo 1000 filas** por defecto. El script de importación pagina los existentes para comparar bien.
- Si la app muestra más de 1000 filas, el scraper las recorre por páginas.

### Duplicados
- El script omite los sub-entregables que ya existen en la BD (mismo `año|mes|cliente|indicador|tipo|responsable`).
- Si un mes tiene datos de varios estatus (cerrados, aprobados, etc.), el JSON solo cubre **Entregables Cerrados**. Los otros estatus se agregan aparte.

### Tipos de entregable
- Se crean automáticamente si no existen (con `indicador_id`, `cliente_id` y nombre).
- Para EXACTITUD: si el sub-entregable es "MENSUAL" y ya existe el tipo con el nombre del indicador solo, se reutiliza (Opción A).
- Para QUINCENA 1/2: se crea el tipo con "QUINCENA X".

### Chrome se cuelga
- Si Chrome deja de responder, cerrá todo y volvé a abrir con el modo depuración.
- Reanudá con `RESUME=1` y el mismo `MAX_DETAILS` o uno mayor.

### Archivos
- JSON extraído: `scraper/output/entregables-<anio>-<mes>.json`
- Scripts: `scraper/scrape-cdp.js`, `migrate/validate.js`, `migrate/import.js`
