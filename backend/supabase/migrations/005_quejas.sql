-- =====================================================
-- Módulo Quejas
-- Registro de quejas formales de clientes y su relación
-- con los usuarios afectados (analistas/líderes).
-- Impactará el cálculo de salario variable en fases futuras.
-- =====================================================

CREATE TABLE quejas (
  id             SERIAL PRIMARY KEY,
  cliente_id     INTEGER NOT NULL REFERENCES clientes(id),
  mes            SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio           SMALLINT NOT NULL CHECK (anio >= 2000),
  fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion    TEXT NOT NULL,
  registrado_por INTEGER REFERENCES usuarios(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relación N:M: una queja puede afectar a varios usuarios
-- (ej: al analista responsable y a su líder a la vez).
CREATE TABLE queja_usuarios (
  id         SERIAL PRIMARY KEY,
  queja_id   INTEGER NOT NULL REFERENCES quejas(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  UNIQUE (queja_id, usuario_id)
);

-- Índices para las consultas futuras (por cliente, período y usuario).
CREATE INDEX idx_quejas_cliente ON quejas(cliente_id);
CREATE INDEX idx_quejas_periodo ON quejas(anio, mes);
CREATE INDEX idx_qu_usuario ON queja_usuarios(usuario_id);
