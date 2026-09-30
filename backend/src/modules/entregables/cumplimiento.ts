/**
 * Cálculo de cumplimiento de un entregable.
 *
 * ⚠️ ÚNICO LUGAR donde vive la fórmula. Si el negocio cambia la regla,
 * se edita aquí y todo el sistema (API, tabla, gráficas) queda consistente.
 *
 * Reglas vigentes:
 *   diferencia  = resultado - fecha_compromiso      (en días)
 *   exactitud   = 100 - penalización por errores
 *   puntualidad = 100 si se entregó a tiempo, decae por día de retraso
 *   pct_cumple  = promedio de puntualidad y exactitud
 *   cumple_meta = pct_cumple alcanza la meta de exactitud del cliente
 *
 * `fecha_compromiso` se captura al crear el entregable, por período.
 * NO se usa `clientes.fecha`: esa es la fecha de alta del cliente, es fija,
 * y haría crecer la diferencia mes a mes para los clientes antiguos.
 */

/** Puntos que se descuentan de la exactitud por cada error. */
export const PESO_ERROR_INTERNO = 2;
export const PESO_ERROR_CLIENTE = 5;

/** Puntos que se descuentan de la puntualidad por cada día de retraso. */
export const PESO_DIA_RETRASO = 10;

export interface EntradaCumplimiento {
  /** Fecha real de entrega (campo `resultado`). */
  resultado?: string | null;
  /** Fecha pactada de entrega del entregable (`fecha_compromiso`). */
  fechaCompromiso?: string | null;
  /** Cantidad pactada (`cantidad_compromiso`). */
  cantidadCompromiso?: number | null;
  /** Cantidad real entregada (`resultado_cantidad`). */
  resultadoCantidad?: number | null;
  error_interno?: number | null;
  error_cliente?: number | null;
  /** Meta de exactitud del cliente (`clientes.pct_exactitud`). */
  metaExactitud?: number | null;
}

export interface ResultadoCumplimiento {
  /** Días entre la entrega real y la fecha pactada. Negativo = anticipado. */
  diferencia: number | null;
  puntualidad: number | null;
  exactitud: number | null;
  /** Indicador final de cumplimiento, 0–100. */
  pct_cumple: number | null;
  /** Si alcanzó la meta de exactitud pactada con el cliente. */
  cumple_meta: boolean | null;
}

const SIN_CALCULAR: ResultadoCumplimiento = {
  diferencia: null,
  puntualidad: null,
  exactitud: null,
  pct_cumple: null,
  cumple_meta: null,
};

const MS_POR_DIA = 86_400_000;

/** Acota un valor al rango 0–100 y lo redondea a 2 decimales. */
function acotar(valor: number): number {
  return Math.round(Math.min(100, Math.max(0, valor)) * 100) / 100;
}

/** Días calendario entre dos fechas, ignorando la hora. */
function diasEntre(desde: string, hasta: string): number | null {
  const a = new Date(`${desde}T00:00:00Z`).getTime();
  const b = new Date(`${hasta}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / MS_POR_DIA);
}

/**
 * Calcula el cumplimiento. Devuelve todo en `null` mientras no exista
 * `resultado`: un entregable sin fecha de entrega aún no se evalúa.
 */
export function calcularCumplimiento(e: EntradaCumplimiento): ResultadoCumplimiento {
  const tieneResultadoFecha = e.resultado != null;
  const tieneResultadoCantidad = e.resultadoCantidad != null;

  if (!tieneResultadoFecha && !tieneResultadoCantidad) return SIN_CALCULAR;

  let diferencia: number | null = null;

  if (tieneResultadoCantidad) {
    // Entregable por cantidad: diferencia = pactado - real
    if (e.cantidadCompromiso != null) {
      diferencia = e.cantidadCompromiso - e.resultadoCantidad!;
    }
  } else if (tieneResultadoFecha) {
    // Entregable por fecha: diferencia en días
    diferencia = e.fechaCompromiso ? diasEntre(e.resultado!, e.fechaCompromiso) : null;
  }

  // Puntualidad: entregar en o antes de la fecha vale 100.
  const puntualidad =
    diferencia === null ? null : acotar(100 - Math.max(0, diferencia) * PESO_DIA_RETRASO);

  // Exactitud: se castiga cada error según su origen.
  const exactitud = acotar(
    100 -
      (e.error_interno ?? 0) * PESO_ERROR_INTERNO -
      (e.error_cliente ?? 0) * PESO_ERROR_CLIENTE,
  );

  // Si no hay fecha de referencia, el cumplimiento es solo exactitud.
  const pct_cumple =
    puntualidad === null ? exactitud : acotar((puntualidad + exactitud) / 2);

  const cumple_meta =
    e.metaExactitud == null ? null : pct_cumple >= Number(e.metaExactitud);

  return { diferencia, puntualidad, exactitud, pct_cumple, cumple_meta };
}

// =====================================================
// NUEVO MODELO — indicadores del sistema.
// Los dos indicadores miden cosas independientes:
//   Plan de Entregables → solo puntualidad (fechas).
//   Exactitud de Cálculos → solo exactitud (cantidades).
// =====================================================

/** Nombres canónicos de los indicadores del sistema. */
export const INDICADOR_PLAN = 'PLAN DE ENTREGABLES';
export const INDICADOR_EXACTITUD = 'EXACTITUD DE CÁLCULOS';

/** Normaliza un nombre de indicador para compararlo. */
export function esIndicadorSistema(nombre: string | null | undefined): 'plan' | 'exactitud' | null {
  if (!nombre) return null;
  const n = nombre.trim().toUpperCase();
  if (n === INDICADOR_PLAN) return 'plan';
  if (n === INDICADOR_EXACTITUD) return 'exactitud';
  return null;
}

/** Plan de Entregables: cumplimiento = puntualidad vs meta de puntualidad. */
export function calcularPlan(e: {
  resultado?: string | null;
  fechaCompromiso?: string | null;
  metaPuntualidad?: number | null;
}): ResultadoCumplimiento {
  if (e.resultado == null) return SIN_CALCULAR;

  const diferencia = e.fechaCompromiso ? diasEntre(e.resultado, e.fechaCompromiso) : null;
  const puntualidad =
    diferencia === null ? null : acotar(100 - Math.max(0, diferencia) * PESO_DIA_RETRASO);

  const pct_cumple = puntualidad;
  const cumple_meta =
    e.metaPuntualidad == null || pct_cumple == null
      ? null
      : pct_cumple >= Number(e.metaPuntualidad);

  return { diferencia, puntualidad, exactitud: null, pct_cumple, cumple_meta };
}

/** Exactitud de Cálculos: cumplimiento = correctos/compromiso vs meta de exactitud. */
export function calcularExactitud(e: {
  resultadoCantidad?: number | null;
  cantidadCompromiso?: number | null;
  metaExactitud?: number | null;
}): ResultadoCumplimiento {
  if (e.resultadoCantidad == null) return SIN_CALCULAR;

  // diferencia = compromiso − correctos (positivo = procesos fallidos)
  const diferencia =
    e.cantidadCompromiso != null ? e.cantidadCompromiso - e.resultadoCantidad : null;

  // exactitud = correctos / compromiso × 100 (acotada 0–100)
  const exactitud =
    e.cantidadCompromiso != null && e.cantidadCompromiso > 0
      ? acotar((e.resultadoCantidad / e.cantidadCompromiso) * 100)
      : null;

  const pct_cumple = exactitud;
  // Los errores se registran y clasifican, pero no penalizan aquí:
  // alimentarán el salario variable en fases posteriores.
  const cumple_meta =
    e.metaExactitud == null || pct_cumple == null
      ? null
      : pct_cumple >= Number(e.metaExactitud);

  return { diferencia, puntualidad: null, exactitud, pct_cumple, cumple_meta };
}
