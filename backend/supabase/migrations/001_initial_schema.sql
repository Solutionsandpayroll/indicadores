-- ============================================================
-- Sistema de Indicadores — Schema inicial
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. GRUPOS
-- ─────────────────────────────────────────────
CREATE TABLE grupos (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  mostrar   BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. INDICADORES  (catálogo independiente)
-- ─────────────────────────────────────────────
CREATE TABLE indicadores (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(150) NOT NULL,
  mostrar   BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 3. CARGOS
-- ─────────────────────────────────────────────
CREATE TABLE cargos (
  id          SERIAL PRIMARY KEY,
  descripcion VARCHAR(150) NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 4. CONCEPTOS
-- ─────────────────────────────────────────────
CREATE TABLE conceptos (
  id          SERIAL PRIMARY KEY,
  descripcion VARCHAR(150) NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 5. TIPO_RCA  (catálogo)
-- ─────────────────────────────────────────────
CREATE TABLE tipo_rca (
  id          SERIAL PRIMARY KEY,
  descripcion VARCHAR(150) NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 6. ESTATUS  (catálogo de estados de entregable)
-- ─────────────────────────────────────────────
CREATE TABLE estatus (
  id          SERIAL PRIMARY KEY,
  descripcion VARCHAR(100) NOT NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 7. CLIENTES
-- ─────────────────────────────────────────────
CREATE TABLE clientes (
  id                 SERIAL PRIMARY KEY,
  cliente            VARCHAR(150) NOT NULL,
  grupo_id           INTEGER NOT NULL REFERENCES grupos(id),
  pct_puntualidad    NUMERIC(5,2),
  pct_exactitud      NUMERIC(5,2),
  pct_contratacion   NUMERIC(5,2),
  fecha              DATE,
  mostrar            BOOLEAN NOT NULL DEFAULT true,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 8. USUARIOS
-- ─────────────────────────────────────────────
CREATE TABLE usuarios (
  id         SERIAL PRIMARY KEY,
  usuario    VARCHAR(60) NOT NULL UNIQUE,
  contrasena VARCHAR(255) NOT NULL,         -- almacenado como hash bcrypt
  nombre     VARCHAR(150) NOT NULL,
  cargo_id   INTEGER REFERENCES cargos(id),
  email      VARCHAR(150),
  grupo_id   INTEGER REFERENCES grupos(id),
  lider_id   INTEGER REFERENCES usuarios(id), -- auto-referencia
  es_admin   BOOLEAN NOT NULL DEFAULT false,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 9. ENTREGABLES
-- ─────────────────────────────────────────────
CREATE TABLE entregables (
  id            SERIAL PRIMARY KEY,
  mes           SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio          SMALLINT NOT NULL CHECK (anio >= 2000),
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id),
  lider_id      INTEGER REFERENCES usuarios(id),
  estatus_id    INTEGER NOT NULL REFERENCES estatus(id),
  usuario_id    INTEGER REFERENCES usuarios(id),
  pct_avance    NUMERIC(5,2) DEFAULT 0 CHECK (pct_avance BETWEEN 0 AND 100),
  comentarios   TEXT,
  indicador_id  INTEGER NOT NULL REFERENCES indicadores(id),
  tipo          VARCHAR(100),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 10. RCA
-- ─────────────────────────────────────────────
CREATE TABLE rca (
  id              SERIAL PRIMARY KEY,
  codigo          VARCHAR(50),
  anio            SMALLINT NOT NULL CHECK (anio >= 2000),
  grupo_id        INTEGER NOT NULL REFERENCES grupos(id),
  mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  cliente_id      INTEGER NOT NULL REFERENCES clientes(id),
  tipo_rca_id     INTEGER NOT NULL REFERENCES tipo_rca(id),
  errores         TEXT,
  acciones_mejora TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 11. SALARIO_VARIABLE
-- ─────────────────────────────────────────────
CREATE TABLE salario_variable (
  id               SERIAL PRIMARY KEY,
  cargo_id         INTEGER NOT NULL REFERENCES cargos(id),
  concepto_id      INTEGER NOT NULL REFERENCES conceptos(id),
  pct_cumplimiento NUMERIC(5,2),
  pct_peso         NUMERIC(5,2),
  mostrar          BOOLEAN NOT NULL DEFAULT true,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES  (mejoran búsquedas frecuentes)
-- ============================================================
CREATE INDEX idx_clientes_grupo      ON clientes(grupo_id);
CREATE INDEX idx_entregables_cliente ON entregables(cliente_id);
CREATE INDEX idx_entregables_estatus ON entregables(estatus_id);
CREATE INDEX idx_entregables_indicad ON entregables(indicador_id);
CREATE INDEX idx_entregables_mes_año ON entregables(anio, mes);
CREATE INDEX idx_rca_cliente         ON rca(cliente_id);
CREATE INDEX idx_rca_grupo           ON rca(grupo_id);
CREATE INDEX idx_rca_mes_año         ON rca(anio, mes);
CREATE INDEX idx_usuarios_cargo      ON usuarios(cargo_id);
CREATE INDEX idx_usuarios_grupo      ON usuarios(grupo_id);
CREATE INDEX idx_salario_cargo       ON salario_variable(cargo_id);

-- ============================================================
-- SEED — Catálogos iniciales
-- ============================================================

-- Estatus de entregables
INSERT INTO estatus (descripcion) VALUES
  ('Asignado'),
  ('En proceso'),
  ('Terminado'),
  ('Aprobado'),
  ('Cerrado');

-- Tipos de RCA
INSERT INTO tipo_rca (descripcion) VALUES
  ('Calidad'),
  ('Tiempo'),
  ('Proceso'),
  ('Recurso humano'),
  ('Tecnología');

-- Cargo y usuario admin inicial
INSERT INTO cargos (descripcion) VALUES ('Administrador');

-- Contraseña: Admin2026! (hash bcrypt cost=10)
-- CAMBIA LA CONTRASEÑA en el primer inicio de sesión
INSERT INTO usuarios (usuario, contrasena, nombre, cargo_id, es_admin, activo)
VALUES (
  'admin',
  '$2b$10$bt2HDd5WJE68CcGJy.V84uy/bDMZLrsMm/3QW5UzURzjtO3jfcata',
  'Administrador',
  1,
  true,
  true
);
