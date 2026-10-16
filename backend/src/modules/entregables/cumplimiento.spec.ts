import {
  esIndicadorSistema,
  calcularPlan,
  calcularExactitud,
  correctosExactitud,
  pctExactitudConjunto,
  calcularImpactoVariable,
  PESO_DIA_RETRASO,
} from './cumplimiento';

describe('esIndicadorSistema', () => {
  it('reconoce los dos indicadores del sistema, sin importar mayúsculas/espacios', () => {
    expect(esIndicadorSistema('PLAN DE ENTREGABLES')).toBe('plan');
    expect(esIndicadorSistema('  Exactitud de Cálculos ')).toBe('exactitud');
  });

  it('devuelve null para indicadores normales o sin nombre', () => {
    expect(esIndicadorSistema('NOMINAS QUINCAS')).toBeNull();
    expect(esIndicadorSistema(null)).toBeNull();
    expect(esIndicadorSistema(undefined)).toBeNull();
  });
});

describe('calcularPlan (puntualidad)', () => {
  const meta = { fechaCompromiso: '2026-07-10', metaPuntualidad: 95 };

  it('no evalúa mientras no haya fecha de resultado', () => {
    const r = calcularPlan({ ...meta, resultado: null });
    expect(r.pct_cumple).toBeNull();
    expect(r.diferencia).toBeNull();
    expect(r.puntualidad).toBeNull();
  });

  it('entrega puntual da 100%', () => {
    const r = calcularPlan({ ...meta, resultado: '2026-07-10' });
    expect(r.diferencia).toBe(0);
    expect(r.puntualidad).toBe(100);
    expect(r.pct_cumple).toBe(100);
    expect(r.cumple_meta).toBe(true);
  });

  it('entrega anticipada no penaliza (diferencia negativa)', () => {
    const r = calcularPlan({ ...meta, resultado: '2026-07-07' });
    expect(r.diferencia).toBe(-3);
    expect(r.puntualidad).toBe(100);
  });

  it('cada día de retraso descuenta PESO_DIA_RETRASO puntos', () => {
    const r = calcularPlan({ ...meta, resultado: '2026-07-13' });
    expect(r.diferencia).toBe(3);
    expect(r.puntualidad).toBe(100 - 3 * PESO_DIA_RETRASO);
    expect(r.cumple_meta).toBe(false);
  });

  it('nunca baja de 0', () => {
    const r = calcularPlan({ ...meta, resultado: '2027-07-10' });
    expect(r.puntualidad).toBe(0);
    expect(r.pct_cumple).toBe(0);
  });

  it('sin fecha de compromiso no hay puntualidad evaluable', () => {
    const r = calcularPlan({ resultado: '2026-07-10', fechaCompromiso: null });
    expect(r.diferencia).toBeNull();
    expect(r.puntualidad).toBeNull();
    expect(r.cumple_meta).toBeNull();
  });

  it('la referencia es el compromiso, no una fecha global', () => {
    const r = calcularPlan({ fechaCompromiso: '2026-07-31', resultado: '2026-07-30' });
    expect(r.diferencia).toBe(-1);
    expect(r.puntualidad).toBe(100);
  });
});

describe('correctosExactitud (por perspectiva)', () => {
  it('analista paga errores internos y de cliente', () => {
    expect(correctosExactitud(100, 5, 1, 'analista')).toBe(94);
  });

  it('líder y cliente solo pagan errores de cliente', () => {
    expect(correctosExactitud(100, 5, 1, 'lider')).toBe(99);
    expect(correctosExactitud(100, 5, 1, 'cliente')).toBe(99);
  });

  it('nunca devuelve negativos', () => {
    expect(correctosExactitud(10, 99, 99, 'analista')).toBe(0);
  });
});

describe('calcularExactitud', () => {
  const meta = { cantidadCompromiso: 100, metaExactitud: 99.65 };

  it('no evalúa sin cantidad procesada', () => {
    const r = calcularExactitud({ ...meta, cantidadProcesada: null, errorInterno: 0, errorCliente: 0 });
    expect(r.pct_cumple).toBeNull();
    expect(r.exactitud).toBeNull();
  });

  it('todo procesado y sin errores da 100%', () => {
    const r = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 0, errorCliente: 0 });
    expect(r.diferencia).toBe(0);
    expect(r.exactitud).toBe(100);
    expect(r.cumple_meta).toBe(true);
  });

  it('penaliza más los errores de cliente que los internos (para el líder)', () => {
    const interno = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 1, errorCliente: 0, perspectiva: 'lider' });
    const cliente = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 0, errorCliente: 1, perspectiva: 'lider' });
    expect(interno.exactitud).toBe(100);
    expect(cliente.exactitud).toBe(99);
  });

  it('para el analista ambos errores pesan igual', () => {
    const interno = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 1, errorCliente: 0 });
    const cliente = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 0, errorCliente: 1 });
    expect(interno.exactitud).toBe(99);
    expect(cliente.exactitud).toBe(99);
  });

  it('marca incumplimiento de meta cuando no alcanza la exactitud pactada', () => {
    const r = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 2, errorCliente: 0 });
    expect(r.pct_cumple).toBe(98);
    expect(r.cumple_meta).toBe(false);
  });

  it('diferencia = casos comprometidos que no se procesaron', () => {
    const r = calcularExactitud({ ...meta, cantidadProcesada: 80, errorInterno: 0, errorCliente: 0 });
    expect(r.diferencia).toBe(20);
    expect(r.exactitud).toBe(80);
  });

  it('nunca baja de 0 ni sube de 100', () => {
    const r = calcularExactitud({ ...meta, cantidadProcesada: 100, errorInterno: 999, errorCliente: 999 });
    expect(r.exactitud).toBe(0);
    const alto = calcularExactitud({ cantidadCompromiso: 10, cantidadProcesada: 50, errorInterno: 0, errorCliente: 0 });
    expect(alto.exactitud).toBe(100);
  });

  it('sin compromiso no hay exactitud evaluable', () => {
    const r = calcularExactitud({ cantidadProcesada: 50, errorInterno: 0, errorCliente: 0, cantidadCompromiso: null });
    expect(r.exactitud).toBeNull();
    expect(r.pct_cumple).toBeNull();
  });
});

describe('pctExactitudConjunto', () => {
  it('sin compromiso devuelve null', () => {
    expect(pctExactitudConjunto(0, 100, 0, 0, 'analista')).toBeNull();
  });

  it('consolida correctamente por perspectiva', () => {
    expect(pctExactitudConjunto(200, 200, 10, 5, 'analista')).toBe(92.5);
    expect(pctExactitudConjunto(200, 200, 10, 5, 'lider')).toBe(97.5);
  });
});

describe('calcularImpactoVariable', () => {
  const base = { errorInterno: 0, errorCliente: 0, perspectiva: 'analista' as const };

  // ── PLAN ──
  it('caso 1 · PLAN entregado dentro de fecha → sin_afectacion', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: '2026-07-10', fechaCompromiso: '2026-07-10',
    })).toBe('sin_afectacion');
  });

  it('PLAN entregado antes de fecha → sin_afectacion', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: '2026-07-08', fechaCompromiso: '2026-07-10',
    })).toBe('sin_afectacion');
  });

  it('caso 2 · PLAN entregado fuera de fecha → afecta', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: '2026-07-11', fechaCompromiso: '2026-07-10',
    })).toBe('afecta');
  });

  it('caso 4 · PLAN sin resultado → pendiente', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: null, fechaCompromiso: '2026-07-10',
    })).toBe('pendiente');
  });

  it('PLAN con resultado pero sin fecha compromiso → pendiente (no evaluable)', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: '2026-07-10', fechaCompromiso: null,
    })).toBe('pendiente');
  });

  it('PLAN a tiempo con error de cliente → afecta (analista y líder)', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: '2026-07-10', fechaCompromiso: '2026-07-10', errorCliente: 1,
    })).toBe('afecta');
    expect(calcularImpactoVariable({
      modo: 'plan', resultado: '2026-07-10', fechaCompromiso: '2026-07-10',
      errorInterno: 0, errorCliente: 1, perspectiva: 'lider',
    })).toBe('afecta');
  });

  it('PLAN a tiempo con solo error interno → afecta al analista, no al líder', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: '2026-07-10', fechaCompromiso: '2026-07-10', errorInterno: 1,
    })).toBe('afecta');
    expect(calcularImpactoVariable({
      modo: 'plan', resultado: '2026-07-10', fechaCompromiso: '2026-07-10',
      errorInterno: 1, errorCliente: 0, perspectiva: 'lider',
    })).toBe('sin_afectacion');
  });

  it('PLAN pendiente sin resultado → pendiente aunque tenga errores', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'plan', resultado: null, fechaCompromiso: '2026-07-10', errorCliente: 2,
    })).toBe('pendiente');
  });

  // ── EXACTITUD ──
  const exact = {
    modo: 'exactitud' as const, resultadoCantidad: 100, cantidadCompromiso: 100,
  };

  it('caso 3 · EXACTITUD sin errores → sin_afectacion (analista y líder)', () => {
    expect(calcularImpactoVariable({ ...exact, ...base })).toBe('sin_afectacion');
    expect(calcularImpactoVariable({ ...exact, errorInterno: 0, errorCliente: 0, perspectiva: 'lider' }))
      .toBe('sin_afectacion');
  });

  it('caso 4 · EXACTITUD 1 error interno → afecta al analista, no al líder', () => {
    expect(calcularImpactoVariable({ ...exact, errorInterno: 1, errorCliente: 0, perspectiva: 'analista' }))
      .toBe('afecta');
    expect(calcularImpactoVariable({ ...exact, errorInterno: 1, errorCliente: 0, perspectiva: 'lider' }))
      .toBe('sin_afectacion');
  });

  it('caso 5 · EXACTITUD 1 error cliente → afecta a analista y líder', () => {
    expect(calcularImpactoVariable({ ...exact, errorInterno: 0, errorCliente: 1, perspectiva: 'analista' }))
      .toBe('afecta');
    expect(calcularImpactoVariable({ ...exact, errorInterno: 0, errorCliente: 1, perspectiva: 'lider' }))
      .toBe('afecta');
  });

  it('caso 6 · EXACTITUD interno + cliente → afecta a ambos', () => {
    expect(calcularImpactoVariable({ ...exact, errorInterno: 1, errorCliente: 1, perspectiva: 'analista' }))
      .toBe('afecta');
    expect(calcularImpactoVariable({ ...exact, errorInterno: 1, errorCliente: 1, perspectiva: 'lider' }))
      .toBe('afecta');
  });

  it('caso 7 · EXACTITUD sin resultado → pendiente, aunque haya errores', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'exactitud', resultadoCantidad: null, cantidadCompromiso: 100,
      errorInterno: 2, errorCliente: 1,
    })).toBe('pendiente');
  });

  it('caso 3 (regla 2) · procesados < compromiso sin errores → afecta', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'exactitud', resultadoCantidad: 95, cantidadCompromiso: 100,
    })).toBe('afecta');
    expect(calcularImpactoVariable({
      modo: 'exactitud', resultadoCantidad: 95, cantidadCompromiso: 100,
      errorInterno: 0, errorCliente: 0, perspectiva: 'lider',
    })).toBe('afecta');
  });

  it('procesados >= compromiso sin errores → sin_afectacion', () => {
    expect(calcularImpactoVariable({
      ...base, modo: 'exactitud', resultadoCantidad: 120, cantidadCompromiso: 100,
    })).toBe('sin_afectacion');
  });

  // ── Caso 8: independencia de % Cumple ──
  it('caso 8 · puede existir % Cumple alto con Impacto = afecta (no se vinculan)', () => {
    // error interno 1 sobre procesados 100/100: el líder ve % Cumple... y sin afectación;
    // el analista ve afectación aunque el consolidado aún decida su meta.
    const impactoAnalista = calcularImpactoVariable({ ...exact, errorInterno: 1, errorCliente: 0, perspectiva: 'analista' });
    const cumple = calcularExactitud({
      cantidadProcesada: 100, cantidadCompromiso: 100, errorInterno: 1, errorCliente: 0,
    });
    expect(impactoAnalista).toBe('afecta');
    // % Cumple NO se fuerza a cambiar por el impacto: sigue su propia fórmula.
    expect(cumple.pct_cumple).toBe(99);
    // Y puede darse % Cumple 100 con afecta: tope por exceso de procesados + error.
    const alto = calcularExactitud({ cantidadProcesada: 150, cantidadCompromiso: 100, errorInterno: 1, errorCliente: 0 });
    const impactoAlto = calcularImpactoVariable({
      ...base, modo: 'exactitud', resultadoCantidad: 150, cantidadCompromiso: 100, errorInterno: 1, errorCliente: 0,
    });
    expect(alto.pct_cumple).toBe(100);
    expect(impactoAlto).toBe('afecta');
  });

  it('indicadores fuera del sistema → null (sin invento)', () => {
    expect(calcularImpactoVariable({ ...base, modo: null, resultado: '2026-07-10' })).toBeNull();
  });
});
