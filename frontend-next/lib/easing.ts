import type { BezierDefinition } from 'framer-motion'

/**
 * Curvas de easing compartidas.
 *
 * Van tipadas como `BezierDefinition` (tupla readonly de 4) porque un literal
 * suelto se infiere como `number[]` y falla el type check del build.
 */

/** Entradas y salidas de elementos. */
export const easeOut: BezierDefinition = [0.23, 1, 0.32, 1]

/** Movimiento de un punto a otro dentro de la pantalla. */
export const easeInOut: BezierDefinition = [0.77, 0, 0.175, 1]

/** Paneles y drawers laterales. */
export const easeDrawer: BezierDefinition = [0.32, 0.72, 0, 1]
