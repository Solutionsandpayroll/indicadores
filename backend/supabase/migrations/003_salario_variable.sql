-- =====================================================
-- Módulo Salario Variable
-- =====================================================

-- Sección 1: Configuración por Perfil
CREATE TABLE salario_variable_config (
  id              SERIAL PRIMARY KEY,
  perfil          VARCHAR(20) NOT NULL CHECK (perfil IN ('Analista', 'Lider')),
  concepto_id     INTEGER NOT NULL REFERENCES conceptos(id),
  pct_meta        NUMERIC(5,2) DEFAULT 0,      -- meta mínima de cumplimiento
  pct_peso        NUMERIC(5,2) DEFAULT 0,      -- porcentaje de peso en el cálculo
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sección 2: Valores de Variable por usuario
CREATE TABLE salario_variable_valores (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,  -- valor monetario
  periodo_anio    SMALLINT NOT NULL,
  periodo_mes     SMALLINT NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  vigencia_desde  DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_hasta  DATE,
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historial de valores
CREATE TABLE salario_variable_valores_hist (
  id              SERIAL PRIMARY KEY,
  valor_id        INTEGER NOT NULL REFERENCES salario_variable_valores(id),
  valor_anterior  NUMERIC(12,2),
  valor_nuevo     NUMERIC(12,2),
  modificado_por  INTEGER REFERENCES usuarios(id),
  modificado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sección 3: Casos Especiales
CREATE TABLE salario_variable_casos (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  descripcion     VARCHAR(250) NOT NULL,
  tipo_regla      VARCHAR(30) NOT NULL DEFAULT 'equipo',  -- 'equipo', 'grupo', 'mixto'
  configuracion   JSONB NOT NULL DEFAULT '{}',              -- reglas flexibles
  activo          BOOLEAN NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sección 4: Resultados (cálculo almacenado)
CREATE TABLE salario_variable_resultados (
  id                SERIAL PRIMARY KEY,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
  periodo_anio      SMALLINT NOT NULL,
  periodo_mes       SMALLINT NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  pct_cumplimiento  NUMERIC(5,2),
  errores_internos  INTEGER DEFAULT 0,
  errores_cliente   INTEGER DEFAULT 0,
  quejas            INTEGER DEFAULT 0,
  pct_final         NUMERIC(5,2),
  valor_asignado    NUMERIC(12,2),
  valor_a_pagar     NUMERIC(12,2),
  calculado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, periodo_anio, periodo_mes)
);

-- Índices
CREATE INDEX idx_svc_perfil ON salario_variable_config(perfil);
CREATE INDEX idx_svv_usuario ON salario_variable_valores(usuario_id);
CREATE INDEX idx_svv_periodo ON salario_variable_valores(periodo_anio, periodo_mes);
CREATE INDEX idx_svcaso_usuario ON salario_variable_casos(usuario_id);
CREATE INDEX idx_svr_usuario ON salario_variable_resultados(usuario_id);
CREATE INDEX idx_svr_periodo ON salario_variable_resultados(periodo_anio, periodo_mes);
