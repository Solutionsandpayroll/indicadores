/**
 * Cálculo de cumplimiento de un entregable.
 *
 * ⚠️ ÚNICO LUGAR donde vive la fórmula.
 *
 * Dos indicadores del sistema, miden cosas independientes:
 *   Plan de Entregables → puntualidad (fecha compromiso vs fecha real).
 *   Exactitud de Cálculos → exactitud por perspectiva (cantidades).
 *
 * Semántica de Exactitud:
 *   cantidad_compromiso = casos comprometidos (denominador)
 *   resultado_cantidad  = cantidad PROCESADA (no "correctos")
 *   error_interno       = casos con error detectado y corregido antes del cliente
 *   error_cliente       = casos con error que llegó al cliente
 *
 *   correctos según quién evalúa:
 *     analista : procesados - error_interno - error_cliente
 *     líder    : procesados - error_cliente
 *     cliente  : procesados - error_cliente
 *   pct = correctos / compromiso × 100
 *
 * La corrección de un error NUNCA elimina el error ni revierte su impacto:
 * el error existió (fila en entregable_errores), la corrección solo se registra.
 */

/** Puntos que se descuentan de la puntualidad por cada día de retraso. */
export const PESO_DIA_RETRASO = 10;

/** Perspectiva desde la que se evalúa la exactitud. */
export type Perspectiva = 'analista' | 'lider' | 'cliente';

export interface ResultadoCumplimiento {
  diferencia: number | null;
  puntualidad: number | null;
  exactitud: number | null;
  pct_cumple: number | null;
  cumple_meta: boolean | null;
}

const SIN_CALCULAR: ResultadoCumplimiento = {
  diferencia: null, puntualidad: null, exactitud: null, pct_cumple: null, cumple_meta: null,
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

// =====================================================
// Indicadores del sistema
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

/** Casos correctos según la perspectiva que evalúa. */
export function correctosExactitud(
  procesados: number,
  errorInterno: number,
  errorCliente: number,
  perspectiva: Perspectiva,
): number {
  const base = perspectiva === 'analista'
    ? procesados - errorInterno - errorCliente
    : procesados - errorCliente;
  return Math.max(0, base);
}

/**
 * Exactitud de Cálculos para una perspectiva dada.
 * `cantidadProcesada` = resultado_cantidad (unidades realmente procesadas).
 */
export function calcularExactitud(e: {
  cantidadProcesada?: number | null;
  cantidadCompromiso?: number | null;
  errorInterno: number;
  errorCliente: number;
  metaExactitud?: number | null;
  perspectiva?: Perspectiva;
}): ResultadoCumplimiento {
  if (e.cantidadProcesada == null || e.cantidadProcesada === 0) {
    // Sin procesar no hay exactitud evaluable, pero sí puede haber compromiso
    // (pendiente). Devolvemos null para no contaminar promedios.
    if (e.cantidadProcesada == null) return SIN_CALCULAR;
  }

  const perspectiva = e.perspectiva ?? 'analista';
  const procesados = e.cantidadProcesada ?? 0;
  const correctos = correctosExactitud(procesados, e.errorInterno, e.errorCliente, perspectiva);

  // diferencia = compromiso - procesados (casos no procesados)
  const diferencia =
    e.cantidadCompromiso != null ? e.cantidadCompromiso - procesados : null;

  const exactitud =
    e.cantidadCompromiso != null && e.cantidadCompromiso > 0
      ? acotar((correctos / e.cantidadCompromiso) * 100)
      : null;

  const pct_cumple = exactitud;
  const cumple_meta =
    e.metaExactitud == null || pct_cumple == null
      ? null
      : pct_cumple >= Number(e.metaExactitud);

  return { diferencia, puntualidad: null, exactitud, pct_cumple, cumple_meta };
}

/**
 * Exactitud de un conjunto ya agregado (suma de procesados, compromiso y errores).
 * Devuelve el % para una perspectiva. Usado por consolidaciones (usuario/cliente).
 */
export function pctExactitudConjunto(
  compromiso: number,
  procesados: number,
  errorInterno: number,
  errorCliente: number,
  perspectiva: Perspectiva,
): number | null {
  if (compromiso <= 0) return null;
  const correctos = correctosExactitud(procesados, errorInterno, errorCliente, perspectiva);
  return Math.round((correctos / compromiso) * 10000) / 100;
}
