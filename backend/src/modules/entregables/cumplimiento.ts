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
  if (!e.resultado) return SIN_CALCULAR;

  // Diferencia contra la fecha pactada del entregable.
  const diferencia = e.fechaCompromiso ? diasEntre(e.resultado, e.fechaCompromiso) : null;

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
