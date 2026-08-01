# Plan de Implementación — Sistema de Indicadores

> Sistema de gestión (CRUD) de indicadores, entregables, clientes y variables de negocio.
> Backend robusto y seguro (principios SOLID) + Dashboard moderno con sidebar, login y animaciones sutiles.

---

## 1. Stack tecnológico (arquitectura pertinente, no sobrecomplicada)

| Capa | Tecnología | Por qué |
|---|---|---|
| **Base de datos** | PostgreSQL (Supabase, ya provisionada) | Ya tienes la instancia. Relacional, encaja con el modelo. |
| **Backend** | Node.js + **NestJS** + TypeScript | NestJS impone SOLID de fábrica (módulos, inyección de dependencias, capas controller/service/repository). Robusto y mantenible. |
| **ORM** | **Prisma** | Tipado fuerte, migraciones versionadas, encaja con NestJS y Postgres. |
| **Auth** | JWT propio (Passport en NestJS) + bcrypt | El modelo `Usuarios` ya define `usuario/contrasena`. Control total, sin acoplarnos a Supabase Auth. |
| **Frontend** | **React + Vite + TypeScript** | Rápido, ligero, suficiente para un dashboard. |
| **UI** | **Tailwind CSS** + shadcn/ui + Framer Motion | Aplica directo los principios de las skills (impeccable/taste). Animaciones sutiles GPU. |
| **Estado/datos** | TanStack Query (React Query) | Caché, sincronización y manejo de CRUD limpio contra la API. |
| **Routing** | React Router | Sidebar ↔ rutas. |

> **Por qué NO un monolito Next.js:** separar back y front deja el backend reutilizable, testeable y alineado a SOLID (requisito explícito). NestJS + Vite/React es la combinación con mejor relación robustez/simplicidad para esto.

```
indicadores/
├── backend/            # NestJS API
│   ├── prisma/         # schema.prisma + migraciones
│   └── src/
│       ├── auth/       # login, JWT, guards
│       ├── modules/    # un módulo por entidad (clientes, grupos, ...)
│       │   └── <entidad>/  controller + service + dto + entity
│       └── common/     # filtros, interceptors, pipes, decoradores
├── frontend/           # React + Vite
│   └── src/
│       ├── components/ # ui/, layout/ (Sidebar, Topbar)
│       ├── features/   # un folder por pestaña
│       ├── lib/        # api client, query client
│       └── theme/      # tokens de color, tipografía
└── .env                # ya existe (credenciales Supabase)
```

---

## 2. Resumen de Base de Datos

Modelo refinado a partir de `dbdesignindicadores.txt`. Decisiones tomadas:
- `estatus` de entregables → **tabla `estatus`** (catálogo), no texto libre → integridad referencial.
- Campo `mostrar` → `boolean` para soft-toggle de visibilidad (no soft-delete).
- Naming normalizado a snake_case en inglés/español consistente; PK `id` autoincremental salvo donde el negocio define código.

### Entidades y relaciones

| Tabla | Campos clave | Relaciones |
|---|---|---|
| **grupos** | id, nombre, mostrar | 1—N con clientes y usuarios |
| **clientes** | id, cliente, grupo_id, pct_puntualidad, pct_exactitud, pct_contratacion, fecha, mostrar | N—1 grupo; 1—N entregables y rca |
| **indicadores** | id, nombre, mostrar | 1—N entregables |
| **estatus** | id, descripcion | catálogo (asignado, en proceso, terminado, aprobado, cerrado) |
| **entregables** | id, mes, anio, cliente_id, lider_id, estatus_id, usuario_id, pct_avance, comentarios, indicador_id, tipo | N—1 cliente, usuario(líder), estatus, indicador |
| **tipo_rca** | id, descripcion | catálogo |
| **rca** | codigo, anio, grupo_id, mes, cliente_id, tipo_rca_id, errores, acciones_mejora | N—1 grupo, cliente, tipo_rca |
| **cargos** | id, descripcion | 1—N usuarios y salario_variable |
| **conceptos** | id, descripcion | 1—N salario_variable |
| **salario_variable** | id, cargo_id, concepto_id, pct_cumplimiento, pct_peso, mostrar | N—1 cargo, concepto |
| **usuarios** | id, usuario, contrasena(hash), nombre, cargo_id, email, grupo_id, lider_id, activo, es_admin | N—1 cargo, grupo; auto-ref líder (otro usuario) |

> **Relación Cliente ↔ Indicadores (CONFIRMADO):** los indicadores **no** se asignan directamente al cliente. La relación es **Cliente → Entregables**, y cada entregable referencia un indicador. Los `%` (puntualidad, exactitud, contratación) son métricas propias del cliente. No hay tabla pivote `cliente_indicador`.

### Modelo de roles (CONFIRMADO)

El **rol funcional deriva del `cargo`** del usuario (no es una columna de enum aparte). Adicionalmente existe un flag **`es_admin`** (boolean) que otorga acceso total.

- El `cargo_id` define qué representa el usuario en el negocio (líder, analista, etc.).
- `es_admin = true` → acceso a todo, incluida la gestión de **Usuarios** y catálogos.
- `es_admin = false` → opera el resto de pestañas según su cargo; **no** ve gestión de Usuarios.
- La autorización en backend se resuelve con un `AdminGuard` que lee `es_admin` del JWT.

### Diagrama de relaciones (resumen)

```
grupos ──< clientes ──< entregables >── indicadores
   │           │              │
   │           │              ├──> estatus
   │           └──< rca >── tipo_rca
   │
   └──< usuarios >── cargos
                  │
        (lider_id auto-referencia)

cargos ──< salario_variable >── conceptos
```

---

## 3. Backend (NestJS — principios SOLID)

**Patrón por entidad** (Single Responsibility + Dependency Inversion):
```
modules/clientes/
├── clientes.controller.ts   # solo HTTP: rutas y validación de entrada
├── clientes.service.ts      # lógica de negocio
├── clientes.repository.ts   # acceso a datos (Prisma) — abstracción inyectable
├── dto/                     # create/update DTOs con class-validator
└── clientes.module.ts
```

- **CRUD genérico:** un `BaseService<T>` y `BaseController<T>` para no repetir CRUD en cada módulo (DRY), extendido cuando una entidad tiene reglas propias (Open/Closed).
- **Seguridad:**
  - `AuthModule` con `LoginDto` (**login por `usuario`**, no email), validación bcrypt, emisión de JWT.
  - JWT lleva `sub`, `usuario`, `es_admin`, `cargo_id` para resolver permisos en front y back.
  - `JwtAuthGuard` global + `@Public()` para login.
  - `AdminGuard` (lee `es_admin` del JWT) para proteger gestión de Usuarios y catálogos.
  - `ValidationPipe` global (whitelist + transform), `ClassSerializerInterceptor` para nunca exponer `contrasena`.
  - Helmet, CORS restringido al front, rate-limit en `/auth/login`.
- **Endpoints** (REST): `/auth/login`, y `/clientes`, `/grupos`, `/entregables`, `/indicadores`, `/rca`, `/tipo-rca`, `/cargos`, `/conceptos`, `/salario-variable`, `/usuarios` — cada uno con `GET / GET:id / POST / PATCH:id / DELETE:id`.

---

## 4. Frontend (Dashboard)

### Identidad gráfica (tokens — OKLCH derivado de tu paleta)
```css
--primary:    #102a47;  /* azul corporativo profundo */
--accent:     #e51148;  /* magenta de acción */
--bg-light:   #f6f7f8;
--bg-dark:    #13191f;
```
- **Light/dark theme** con esos tokens. Tema por defecto: claro (uso de oficina, luz ambiente alta).
- Tipografía en eje de contraste (no dos sans iguales). Accent `#e51148` reservado a acciones primarias y estados activos — nunca como fondo decorativo.

### Estructura de UI
- **Login** (fuera del sidebar): pantalla limpia, formulario centrado, **entrada con `usuario`** (no email), microinteracción sutil en submit, sin gradientes AI.
- **Layout app:** `Sidebar` (navegación) + `Topbar` (usuario, theme toggle) + contenido.
- **Pestañas → rutas:**
  `Home` (dashboard con métricas resumen) · `Clientes` · `Grupos` · `Entregables` · `Indicadores` · `RCA` · `Otras Variables` (Cargos, Conceptos, Salario Variable en tabs internos) · `Usuarios` (**solo `es_admin`**).
- **Patrón CRUD reutilizable:** componente `DataTable` + `EntityForm` (modal/drawer) parametrizado por entidad → cada pestaña es una instancia configurada. Evita reescribir tablas.
- **Animaciones:** solo `transform`/`opacity`, `ease-out` custom, < 300ms, con `prefers-reduced-motion`. Sidebar y modales con `transform-origin` correcto.

---

## 5. Pasos a seguir

### Fase 0 — Setup (cimientos)
1. Inicializar `backend/` (NestJS) y `frontend/` (Vite + React + TS).
2. Configurar Tailwind + tokens de color + shadcn/ui en el front.
3. Conectar Prisma a Supabase usando la cadena del `.env` (mover `dbpw` a `DATABASE_URL`).

### Fase 1 — Base de datos
4. Escribir `schema.prisma` con las 11 entidades y relaciones de arriba.
5. Generar migración inicial y aplicarla a Supabase.
6. Seed de catálogos (`estatus`, `tipo_rca`) y un usuario admin inicial.

### Fase 2 — Backend
7. `AuthModule` (login + JWT + guards + bcrypt).
8. Módulos CRUD de las 11 entidades sobre el `BaseService/BaseController`.
9. Validaciones (DTOs), serialización (ocultar password), CORS/Helmet/rate-limit.
10. Pruebas básicas de cada endpoint (e2e mínimas).

### Fase 3 — Frontend
11. Cliente API + React Query + manejo de token (interceptor).
12. Pantalla de **Login** y guard de rutas.
13. **Layout** (Sidebar + Topbar + theme).
14. Componentes `DataTable` + `EntityForm` genéricos.
15. Implementar cada pestaña conectada a su endpoint.
16. **Home**: tres **cards dinámicas** con totales en vivo → **Clientes**, **Entregables** e **Indicadores** (conteos desde la API, con loading skeleton y animación de entrada sutil). Endpoint `/stats/overview` que devuelve los conteos en una sola llamada.

### Fase 4 — Pulido
17. Pase de diseño con las skills (`/impeccable polish`, `/taste-skill`): jerarquía, espaciado, contraste, motion.
18. Manejo de errores, estados vacíos, loading skeletons.
19. Revisión de seguridad (validación, autorización por rol) y responsive.

---

## 6. Decisiones confirmadas

1. **Cliente ↔ Indicadores**: relación **solo vía entregables** (no directa, sin tabla pivote). ✅
2. **Roles**: derivan del **`cargo`** + flag **`es_admin`** adicional para acceso total. ✅
3. **Login**: se entra con **`usuario`**. ✅
4. **Home**: 3 cards dinámicas → **Clientes, Entregables, Indicadores** totales. ✅

---

## 7. Guía de diseño UX/UI (skills aplicadas)

Diseño regido por los principios de `impeccable`, `taste-skill` y `emil-design-eng`:

- **Design Read:** *"Dashboard interno (product UI) para personal de la empresa, con un lenguaje corporativo-sobrio, leaning toward Linear/Stripe-clean: el diseño SIRVE al producto, prioriza familiaridad fluida y legibilidad sobre lo llamativo."*
- **Color:** `#102a47` como ink/estructura, `#e51148` **reservado a la acción** (botón primario, estado activo del sidebar, foco) — nunca como fondo decorativo. Neutrales tintados hacia el azul de marca. Verificar contraste ≥ 4.5:1 en texto. Tema claro por defecto (oficina, luz alta); dark con `#13191f`.
- **Tipografía:** pareja en eje de contraste, line-length 65–75ch en texto, `text-wrap: balance` en títulos.
- **Layout:** sin cards anidadas; rejilla con ritmo de espaciado variable; z-index semántico (sidebar/sticky/modal/toast). Las 3 cards de Home son la única zona "card" deliberada.
- **Motion (sutil, < 300ms, GPU):** solo `transform`/`opacity`, `ease-out` custom. Entrada escalonada de las cards de Home, transición de sidebar con `transform-origin` correcto, `:active scale(0.97)` en botones. `@media (prefers-reduced-motion: reduce)` siempre.
- **Anti-slop:** sin gradientes morados, sin glassmorphism decorativo, sin eyebrow tracked en cada sección, sin `transition: all`.
- **Pulido final** con `/impeccable polish` y `/impeccable audit` (a11y, contraste, responsive) antes de cerrar cada pantalla.
