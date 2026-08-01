# Guía de despliegue en Render

Guía paso a paso para publicar este proyecto en Render.

**Qué vamos a desplegar:**

| Servicio | Tecnología | Tipo de servicio en Render |
|---|---|---|
| `backend/` | NestJS 11 (TypeScript) | Web Service |
| `frontend-next/` | Next.js 16 + React 19 | Web Service |
| Base de datos | Supabase (PostgreSQL) | **No se despliega en Render** — ya está en Supabase |

> La base de datos sigue viviendo en Supabase. Render solo hospeda el backend y el frontend.

---

## Paso 0 — Requisitos previos

Antes de empezar necesitas:

1. Una cuenta en [render.com](https://render.com) (el plan gratuito sirve para probar).
2. Una cuenta en GitHub.
3. Tu proyecto de Supabase activo, con las migraciones de `backend/supabase/migrations/` ya aplicadas.
4. A la mano, los valores de `backend/.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`

---

## Paso 1 — Subir el código a GitHub

Render despliega desde un repositorio de Git. Hoy el proyecto **no está listo** para eso:

- La carpeta raíz `indicadores/` no es un repositorio Git.
- `frontend-next/` sí es un repositorio, pero solo tiene el commit inicial de Create Next App.
- `backend/` no está versionado.

Lo más simple es crear **un solo repositorio** con todo (un monorepo). Desde la carpeta `indicadores/`:

```bash
# 1. Eliminar el repositorio suelto del frontend para no anidar repos
rm -rf frontend-next/.git

# 2. Inicializar el repositorio en la raíz
git init
git branch -M main
```

Crea un archivo `.gitignore` en la raíz con este contenido:

```gitignore
node_modules/
.env
.env.local
.next/
dist/
*.log
```

> **Importante:** `.env` y `.env.local` NUNCA deben subirse. Contienen tu `SUPABASE_SERVICE_ROLE_KEY`, que da acceso total a la base de datos. En Render las variables se cargan aparte (Paso 2 y 3).

Ahora sube todo:

```bash
git add .
git commit -m "Preparar proyecto para despliegue en Render"
```

Crea un repositorio vacío en GitHub (por ejemplo `indicadores`) y conéctalo:

```bash
git remote add origin https://github.com/TU-USUARIO/indicadores.git
git push -u origin main
```

Verifica en GitHub que **no** aparezcan `.env` ni `node_modules`.

---

## Paso 2 — Desplegar el backend (NestJS)

### 2.1 Crear el servicio

1. En Render: **New +** → **Web Service**.
2. Conecta tu cuenta de GitHub y elige el repositorio `indicadores`.
3. Rellena la configuración:

| Campo | Valor |
|---|---|
| **Name** | `indicadores-backend` |
| **Region** | La más cercana a tus usuarios (ej. Oregon) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Instance Type** | Free (o el plan que prefieras) |

> **Root Directory = `backend`** es la clave: le dice a Render que ignore el resto del monorepo y trabaje solo dentro de esa carpeta.

### 2.2 Variables de entorno

En la sección **Environment Variables**, agrega una por una:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | El de tu `backend/.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | El de tu `backend/.env` |
| `JWT_SECRET` | El de tu `backend/.env` |
| `JWT_EXPIRES_IN` | El de tu `backend/.env` (ej. `1d`) |
| `FRONTEND_URL` | Déjala vacía por ahora — se llena en el **Paso 4** |

**No agregues `PORT`.** Render la inyecta automáticamente y `src/main.ts` ya la lee con `process.env.PORT`.

### 2.3 Desplegar

Haz clic en **Create Web Service**. Render instalará, compilará y arrancará el servicio (tarda unos minutos).

Cuando termine tendrás una URL como:

```
https://indicadores-backend.onrender.com
```

**Anótala**, la necesitas en el Paso 3.

### 2.4 Comprobar que funciona

El backend usa el prefijo global `/api`, así que todos los endpoints viven bajo esa ruta. Abre en el navegador:

```
https://indicadores-backend.onrender.com/api
```

Un error 404 de Nest aquí es **normal y buena señal**: significa que el servidor está vivo y respondiendo. Si en cambio ves un error de Render ("Application failed to respond"), revisa los **Logs** del servicio.

---

## Paso 3 — Desplegar el frontend (Next.js)

### 3.1 Crear el servicio

1. En Render: **New +** → **Web Service**.
2. Elige el **mismo repositorio** `indicadores`.
3. Configura:

| Campo | Valor |
|---|---|
| **Name** | `indicadores-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend-next` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

### 3.2 Variable de entorno

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://indicadores-backend.onrender.com` |

> **Cuidado con esta variable — es el error más común.**
> En [lib/api.ts:4](frontend-next/lib/api.ts#L4) el código hace `baseURL: process.env.NEXT_PUBLIC_API_URL + '/api'`, es decir, **añade `/api` por su cuenta**.
> - Correcto: `https://indicadores-backend.onrender.com`
> - Incorrecto: `https://indicadores-backend.onrender.com/api` → produciría `/api/api/...` y todo fallaría con 404.
>
> Tampoco pongas una barra `/` al final.

Otro detalle: las variables `NEXT_PUBLIC_*` se incrustan **durante el build**, no al arrancar. Si más adelante cambias este valor, hay que hacer un **Manual Deploy → Clear build cache & deploy**; reiniciar el servicio no basta.

### 3.3 Desplegar

Clic en **Create Web Service**. Al terminar tendrás:

```
https://indicadores-frontend.onrender.com
```

---

## Paso 4 — Conectar frontend y backend (CORS)

Falta un paso, si no el navegador bloqueará las peticiones.

En `src/main.ts` el backend solo acepta peticiones del origen indicado en `FRONTEND_URL`:

```ts
app.enableCors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
});
```

Entonces:

1. Ve al servicio **`indicadores-backend`** en Render.
2. Entra a **Environment**.
3. Fija `FRONTEND_URL` con la URL del frontend:
   ```
   https://indicadores-frontend.onrender.com
   ```
   Sin barra `/` al final — debe coincidir exacto con el origen que envía el navegador.
4. Guarda. Render reiniciará el backend automáticamente.

---

## Paso 5 — Probar todo

1. Abre `https://indicadores-frontend.onrender.com`.
2. Deberías llegar a la pantalla de login.
3. Inicia sesión con un usuario existente de tu base de datos.
4. Verifica que el dashboard cargue datos (clientes, indicadores, entregables).

Si el login funciona y ves datos reales, el despliegue está completo.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Error de CORS en la consola del navegador | `FRONTEND_URL` mal escrita o con `/` final | Revisa el Paso 4; debe coincidir exacto con la URL del frontend |
| Todas las peticiones dan 404 | `NEXT_PUBLIC_API_URL` incluye `/api` | Quítalo y redespliega con **Clear build cache** |
| El login siempre rebota a `/login` | El backend responde 401 | Revisa `JWT_SECRET` y que las credenciales existan en Supabase |
| "Application failed to respond" | El backend no arrancó | Mira los **Logs**; suele faltar una variable de entorno |
| La primera carga tarda ~50 segundos | Plan gratuito de Render | Los servicios Free se duermen tras 15 min de inactividad. Se resuelve con un plan de pago |
| Cambié una variable y no surte efecto en el frontend | Las `NEXT_PUBLIC_*` se fijan en el build | **Manual Deploy → Clear build cache & deploy** |

---

## Despliegues posteriores

Render tiene auto-deploy activado por defecto. A partir de aquí:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Cada `push` a `main` redespliega **ambos** servicios automáticamente.

---

## Notas de seguridad

- `SUPABASE_SERVICE_ROLE_KEY` **omite las políticas RLS** de Supabase. Solo debe vivir en el backend (donde ya está) y jamás en una variable `NEXT_PUBLIC_*`, porque esas quedan visibles en el navegador.
- Si en algún momento el `.env` llegó a subirse a GitHub, rota las llaves desde el panel de Supabase — borrarlo del repo no basta, queda en el historial de Git.
- Para producción real, considera un dominio propio (Render lo permite en **Settings → Custom Domain**) y actualiza `FRONTEND_URL` en consecuencia.
