# Migración a Supabase + Despliegue con Blueprint en Render

Dos partes, en este orden:

1. **Parte A** — Crear las tablas en Supabase a mano (SQL Editor).
2. **Parte B** — Desplegar backend y frontend con `render.yaml` (Blueprint).

---

# Parte A — Migrar manualmente a Supabase

## A.0 — Antes de empezar: lee esto

Hay **5 archivos** SQL que correr, y el orden importa. Uno es nuevo:

| # | Archivo | Qué hace |
|---|---|---|
| 1 | `001_initial_schema.sql` | Crea las 11 tablas base, índices y datos iniciales (incluye el usuario `admin`) |
| 2 | `002_entregables_seguimiento.sql` | Agrega columnas de seguimiento, triggers y la tabla `entregables_historial` |
| 3 | **`002b_entregable_tipos.sql`** | **Nuevo.** Crea la tabla `entregable_tipos` |
| 4 | `003_entregable_tipos_seed.sql` | Siembra 5 tipos por cada indicador |
| 5 | `004_entregables_avances.sql` | Crea la bitácora `entregables_avances` |

> **Por qué existe `002b`:** al revisar las migraciones encontré que el paso 003 siembra la tabla `entregable_tipos` y el backend la consulta ([entregable-tipos.service.ts:12](backend/src/modules/entregable-tipos/entregable-tipos.service.ts#L12)), pero **ninguna migración la creaba**. En una base nueva, 003 fallaba con `relation "entregable_tipos" does not exist`. El archivo `002b_entregable_tipos.sql` cubre ese hueco: crea la tabla y agrega `entregables.entregable_tipo_id`. Por eso va **antes** de 003.

Todos los scripts del 002 en adelante son **idempotentes** (usan `IF NOT EXISTS`): si los corres dos veces no rompen nada. El `001` **no lo es** — solo debe correrse una vez, en una base vacía.

## A.1 — Abrir el SQL Editor

1. Entra a [supabase.com](https://supabase.com) y abre tu proyecto.
2. En el menú lateral: **SQL Editor**.
3. Clic en **New query**.

## A.2 — Correr los scripts, uno por uno

Para **cada** archivo de la tabla anterior, en orden:

1. Abre el archivo en tu editor (`backend/supabase/migrations/`).
2. Copia **todo** el contenido.
3. Pégalo en el SQL Editor de Supabase.
4. Clic en **Run** (o `Ctrl+Enter`).
5. Confirma que diga **Success**. Si sale error, **detente** y revisa A.4 antes de seguir.

> No pegues los 5 archivos juntos. De uno en uno, verificando cada resultado — si algo falla, sabes exactamente dónde.

**Qué esperar en cada uno:**

- **001** → `Success. No rows returned`.
- **002** → `Success. No rows returned`.
- **002b** → `Success. No rows returned`.
- **003** → Devuelve una **tabla de resultados** con cada indicador y cuántos tipos se le sembraron. Es normal.
- **004** → `Success. No rows returned`.

### Nota sobre el paso 003

003 siembra tipos solo para los indicadores que ya existan y tengan `mostrar = true`. En una base recién creada **la tabla `indicadores` está vacía**, así que el resultado saldrá sin filas — no es un error.

Si es tu caso, crea primero tus indicadores desde el dashboard (pestaña **Indicadores**) y **vuelve a correr 003**. Es idempotente, no duplica nada.

## A.3 — Verificar que todo quedó bien

Corre esto en el SQL Editor:

```sql
-- Deben aparecer 14 tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Esperado: `cargos`, `clientes`, `conceptos`, `entregable_tipos`, `entregables`, `entregables_avances`, `entregables_historial`, `estatus`, `grupos`, `indicadores`, `rca`, `salario_variable`, `tipo_rca`, `usuarios`.

```sql
-- El usuario admin debe existir
SELECT usuario, nombre, es_admin, activo FROM usuarios;

-- Los catálogos base deben tener datos
SELECT 'estatus' AS tabla, count(*) FROM estatus
UNION ALL SELECT 'tipo_rca', count(*) FROM tipo_rca;
```

Esperado: `admin` activo y con `es_admin = true`; 5 estatus y 5 tipos de RCA.

## A.4 — Si algo falla

| Error | Qué significa | Solución |
|---|---|---|
| `relation "grupos" already exists` | Ya habías corrido 001 antes | La base no estaba vacía. Ve a A.5 |
| `relation "entregable_tipos" does not exist` | Corriste 003 sin 002b | Corre `002b_entregable_tipos.sql` y repite 003 |
| `violates not-null constraint` al crear entregables | Falta `entregable_tipo_id` | Confirma que 002b y 003 corrieron bien |
| 003 no devuelve filas | No hay indicadores todavía | Normal en base nueva. Ver nota en A.2 |

## A.5 — Si tu base ya tenía datos

El encabezado de `002_entregables_seguimiento.sql` documenta que la base de producción quedó **desincronizada** del esquema original (le faltaban `indicador_id` y `tipo`). Si tu proyecto de Supabase **ya tiene datos**, no corras 001: sobrescribir borraría todo.

En ese caso, corre solo **002, 002b, 003 y 004**, que son idempotentes y solo agregan lo que falte. Luego verifica con A.3.

## A.6 — Sobre la contraseña del admin

`001` crea el usuario `admin` con la contraseña **`Admin2026!`** (hash bcrypt).

**Cámbiala apenas entres por primera vez.** Está escrita en un archivo versionado en Git, así que cualquiera con acceso al repo la conoce.

---

# Parte B — Desplegar con Blueprint

Un **Blueprint** es un archivo `render.yaml` que describe todos tus servicios. En vez de crearlos a mano uno por uno, Render los lee y los levanta juntos.

El archivo ya está creado en la raíz: [render.yaml](render.yaml).

## B.1 — Qué define el blueprint

| Servicio | Carpeta | Build | Start |
|---|---|---|---|
| `indicadores-backend` | `backend` | `npm ci && npm run build` | `npm run start:prod` |
| `indicadores-frontend` | `frontend-next` | `npm ci && npm run build` | `npm start` |

Detalles que ya vienen resueltos:

- **`PORT` no se declara.** Render la inyecta sola y [main.ts:34](backend/src/main.ts#L34) ya la lee.
- **`JWT_SECRET` usa `generateValue: true`** — Render genera un secreto aleatorio y seguro. No reutilices el de desarrollo.
- **`healthCheckPath: /api/estatus`** — endpoint público (sin login), así que responde 200 y sirve para detectar si el backend está vivo.
- **Los secretos usan `sync: false`** — Render los pide en pantalla y **nunca** quedan escritos en Git.

## B.2 — Subir el código a GitHub

Render lee el blueprint desde un repositorio. Hoy el proyecto no está listo:

- La raíz `indicadores/` no es un repositorio Git.
- `backend/` no está versionado.
- `frontend-next/` es un repo suelto con solo el commit inicial de Create Next App.

Desde la carpeta `indicadores/`:

```bash
# Eliminar el repo suelto del frontend para no anidar repositorios
rm -rf frontend-next/.git

git init
git branch -M main
```

Crea un `.gitignore` en la raíz:

```gitignore
node_modules/
.env
.env.local
.next/
dist/
*.log
```

> **Crítico:** `.env` contiene tu `SUPABASE_SERVICE_ROLE_KEY`, que **ignora las políticas RLS** de Supabase — es acceso total a la base. Nunca debe llegar a GitHub.

```bash
git add .
git commit -m "Proyecto listo para desplegar en Render"
git remote add origin https://github.com/TU-USUARIO/indicadores.git
git push -u origin main
```

Antes de seguir, abre el repo en GitHub y confirma que **no** aparezcan `.env`, `.env.local` ni `node_modules`.

## B.3 — Crear el Blueprint en Render

1. En Render: **New +** → **Blueprint**.
2. Conecta tu cuenta de GitHub y elige el repositorio `indicadores`.
3. Render detecta `render.yaml` y muestra los dos servicios.
4. Te pedirá los valores marcados `sync: false`:

| Variable | Servicio | Valor |
|---|---|---|
| `SUPABASE_URL` | backend | El de tu `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | El de tu `backend/.env` |
| `FRONTEND_URL` | backend | **Déjala vacía** — se llena en B.5 |
| `NEXT_PUBLIC_API_URL` | frontend | **Déjala vacía** — se llena en B.4 |

5. Clic en **Apply**. Render crea y despliega ambos servicios.

> Las dos URLs quedan vacías porque **todavía no existen**: Render las asigna al crear los servicios. Se llenan en los pasos siguientes. Es esperado que el primer despliegue no funcione del todo hasta terminar B.5.

## B.4 — Conectar el frontend con el backend

1. Abre el servicio `indicadores-backend` y copia su URL, algo como:
   ```
   https://indicadores-backend.onrender.com
   ```
2. Ve a `indicadores-frontend` → **Environment**.
3. Fija `NEXT_PUBLIC_API_URL` con esa URL.

> **La trampa más común.** [lib/api.ts:4](frontend-next/lib/api.ts#L4) hace `process.env.NEXT_PUBLIC_API_URL + '/api'`, o sea **agrega `/api` solo**.
> - Correcto: `https://indicadores-backend.onrender.com`
> - Incorrecto: `.../api` → produce `/api/api/...` y todo da 404.
>
> Tampoco pongas barra `/` al final.

4. Guarda y haz **Manual Deploy → Clear build cache & deploy**.

> Las variables `NEXT_PUBLIC_*` se incrustan **durante el build**, no al arrancar. Un reinicio normal no basta: hay que reconstruir.

## B.5 — Conectar el backend con el frontend (CORS)

[main.ts:14-17](backend/src/main.ts#L14-L17) solo acepta peticiones del origen en `FRONTEND_URL`:

```ts
app.enableCors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
});
```

1. Copia la URL del servicio `indicadores-frontend`.
2. Ve a `indicadores-backend` → **Environment**.
3. Fija `FRONTEND_URL` con esa URL, **sin barra final**:
   ```
   https://indicadores-frontend.onrender.com
   ```
4. Guarda. El backend se reinicia solo.

> **¿Por qué a mano y no automático?** Render permite referenciar otro servicio con `fromService`, pero su propiedad `host` devuelve el hostname de la **red privada**, sin `https://` — no sirve para CORS ni para el navegador. Además, ambos servicios se referenciarían mutuamente, lo que sería circular. Por eso estas dos van a mano, una sola vez.

## B.6 — Probar

1. Abre la URL del frontend.
2. Deberías ver el login.
3. Entra con `admin` / `Admin2026!`.
4. Verifica que el dashboard cargue datos.

Si el login pasa y ves datos, está listo. **Cambia la contraseña del admin ahora** (A.6).

---

## Solución de problemas

| Síntoma | Causa | Solución |
|---|---|---|
| Error de CORS en la consola | `FRONTEND_URL` mal escrita o con `/` final | Revisa B.5; debe coincidir exacto |
| Todas las peticiones dan 404 | `NEXT_PUBLIC_API_URL` incluye `/api` | Quítalo y redespliega con **Clear build cache** |
| Cambié la variable y no pasa nada | Las `NEXT_PUBLIC_*` se fijan en el build | **Manual Deploy → Clear build cache & deploy** |
| "Application failed to respond" | El backend no arrancó | Mira los **Logs**; suele faltar `SUPABASE_URL` |
| El health check falla en bucle | La base no tiene la tabla `estatus` | Corre la Parte A completa |
| Login siempre rebota a `/login` | Backend responde 401 | Confirma que 001 corrió y que `admin` existe (A.3) |
| Error al crear un entregable | Falta `entregable_tipos` | Corre 002b y 003 (A.2) |
| La primera carga tarda ~50s | Plan gratuito | Los servicios Free se duermen tras 15 min. Se quita con plan de pago |

---

## Despliegues posteriores

Con el blueprint conectado, cada `push` a `main` redespliega ambos servicios:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Si editas `render.yaml`, Render aplica los cambios al detectar el push.

---

## Notas de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` **omite RLS**. Solo en el backend, jamás en una variable `NEXT_PUBLIC_*` (esas quedan visibles en el navegador).
- Si el `.env` llegó a subirse a GitHub alguna vez, **rota las llaves** en Supabase: borrarlo del repo no lo saca del historial de Git.
- El `JWT_SECRET` de producción lo genera Render y es distinto al de desarrollo. Correcto: si se filtrara el de local, no sirve contra producción.
- Cambia la contraseña de `admin` en el primer login.
