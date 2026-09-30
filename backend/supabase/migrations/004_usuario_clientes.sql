-- =====================================================
-- Asignación explícita Cliente ↔ Usuario
-- Permite registrar qué usuarios (líderes/analistas)
-- trabajan con cada cliente, con o sin entregables.
-- =====================================================

CREATE TABLE usuario_clientes (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  cliente_id  INTEGER NOT NULL REFERENCES clientes(id),
  rol         VARCHAR(20) NOT NULL CHECK (rol IN ('Lider', 'Analista')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, cliente_id)
);

CREATE INDEX idx_uc_usuario ON usuario_clientes(usuario_id);
CREATE INDEX idx_uc_cliente ON usuario_clientes(cliente_id);
