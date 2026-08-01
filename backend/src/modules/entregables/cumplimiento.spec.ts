import { calcularCumplimiento } from './cumplimiento';

describe('calcularCumplimiento', () => {
  const meta = { fechaCompromiso: '2026-07-10', metaExactitud: 99.65 };

  it('no evalúa mientras no haya fecha de resultado', () => {
    const r = calcularCumplimiento({ ...meta, resultado: null });
    expect(r.pct_cumple).toBeNull();
    expect(r.diferencia).toBeNull();
  });

  it('entrega puntual y sin errores da 100%', () => {
    const r = calcularCumplimiento({ ...meta, resultado: '2026-07-10' });
    expect(r.diferencia).toBe(0);
    expect(r.puntualidad).toBe(100);
    expect(r.exactitud).toBe(100);
    expect(r.pct_cumple).toBe(100);
    expect(r.cumple_meta).toBe(true);
  });

  it('entrega anticipada no penaliza (diferencia negativa)', () => {
    const r = calcularCumplimiento({ ...meta, resultado: '2026-07-07' });
    expect(r.diferencia).toBe(-3);
    expect(r.puntualidad).toBe(100);
  });

  it('cada día de retraso descuenta puntualidad', () => {
    const r = calcularCumplimiento({ ...meta, resultado: '2026-07-13' });
    expect(r.diferencia).toBe(3);
    expect(r.puntualidad).toBe(70);
    expect(r.pct_cumple).toBe(85); // (70 + 100) / 2
  });

  it('penaliza más los errores de cliente que los internos', () => {
    const interno = calcularCumplimiento({ ...meta, resultado: '2026-07-10', error_interno: 1 });
    const cliente = calcularCumplimiento({ ...meta, resultado: '2026-07-10', error_cliente: 1 });
    expect(interno.exactitud).toBe(98);
    expect(cliente.exactitud).toBe(95);
  });

  it('nunca baja de 0 ni sube de 100', () => {
    const r = calcularCumplimiento({ ...meta, resultado: '2027-07-10', error_cliente: 999 });
    expect(r.puntualidad).toBe(0);
    expect(r.exactitud).toBe(0);
    expect(r.pct_cumple).toBe(0);
  });

  it('marca incumplimiento de meta cuando no alcanza la exactitud pactada', () => {
    const r = calcularCumplimiento({ ...meta, resultado: '2026-07-10', error_interno: 2 });
    expect(r.pct_cumple).toBe(98);
    expect(r.cumple_meta).toBe(false);
  });

  it('sin fecha de compromiso, el cumplimiento es solo exactitud', () => {
    const r = calcularCumplimiento({ resultado: '2026-07-10', fechaCompromiso: null, error_interno: 1 });
    expect(r.diferencia).toBeNull();
    expect(r.puntualidad).toBeNull();
    expect(r.pct_cumple).toBe(98);
  });

  it('la referencia es del período, no del alta del cliente', () => {
    // Entregable de julio 2026 entregado a tiempo contra su compromiso del mes.
    // Con la fecha de alta del cliente (2020) esto habría dado ~2000 días tarde.
    const r = calcularCumplimiento({ fechaCompromiso: '2026-07-31', resultado: '2026-07-30' });
    expect(r.diferencia).toBe(-1);
    expect(r.puntualidad).toBe(100);
  });
});
