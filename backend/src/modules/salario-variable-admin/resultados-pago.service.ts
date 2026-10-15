import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CumplimientoService, FilaCumplimiento } from './cumplimiento.service';

export interface FiltrosResultados {
  anio: number;
  mes: number;
  usuarioId?: number;
  clienteId?: number;
  rol?: string;
}

export interface ComponentePago {
  nombre: string;
  metrica: string | null;
  peso: number;
  estado: 'ganado' | 'perdido' | 'pendiente';
  detalle: string;
}

export interface ConsolidadoGlobal {
  plan: {
    asignados: number; evaluados: number; cumplidos: number; incumplidos: number; pendientes: number;
    pct: number | null; meta: number | null;
  };
  exactitud: {
    asignados: number; evaluados: number; pendientes: number;
    compromiso_total: number; correctos_total: number;
    pct: number | null; meta: number | null;
  };
  error_cliente: number;
  error_interno: number;
  quejas: number;
}

export interface FilaResultado {
  usuario: { id: number; nombre: string; usuario: string; rol: string };
  periodo: { anio: number; mes: number };
  clientes: { id: number; cliente: string }[];
  valor_base: number | null;
  consolidado: ConsolidadoGlobal;
  componentes: ComponentePago[];
  pct_final: number;
  valor_a_pagar: number | null;
  caso_especial: boolean;
}

interface ConfigRow {
  perfil: string; metrica: string | null; pct_peso: number | null; pct_meta: number | null;
  conceptos?: { descripcion: string } | null;
}

function evaluarComponente(
  c: ConfigRow,
  planPct: number | null,
  exactPct: number | null,
  errCliPct: number | null,
  errIntPct: number | null,
  quejas: number,
  maxMetaPlan: number | null,
  maxMetaExactitud: number | null,
): ComponentePago {
  const peso = c.pct_peso ?? 0;
  const nombre = c.conceptos?.descripcion ?? '—';

  if (c.metrica === 'plan') {
    if (planPct == null) return { nombre, metrica: c.metrica, peso, estado: 'perdido', detalle: 'sin datos' };
    const gano = maxMetaPlan != null && planPct >= maxMetaPlan;
    return { nombre, metrica: c.metrica, peso, estado: gano ? 'ganado' : 'perdido', detalle: `${planPct}% vs meta ${maxMetaPlan ?? '—'}%` };
  }
  if (c.metrica === 'exactitud') {
    if (exactPct == null) return { nombre, metrica: c.metrica, peso, estado: 'perdido', detalle: 'sin datos' };
    const gano = maxMetaExactitud != null && exactPct >= maxMetaExactitud;
    return { nombre, metrica: c.metrica, peso, estado: gano ? 'ganado' : 'perdido', detalle: `${exactPct}% vs meta ${maxMetaExactitud ?? '—'}%` };
  }
  if (c.metrica === 'error_cliente') {
    if (errCliPct == null) return { nombre, metrica: c.metrica, peso, estado: 'perdido', detalle: 'sin datos' };
    const gano = c.pct_meta != null && errCliPct >= c.pct_meta;
    return { nombre, metrica: c.metrica, peso, estado: gano ? 'ganado' : 'perdido', detalle: `${errCliPct}% vs meta ${c.pct_meta ?? '—'}%` };
  }
  if (c.metrica === 'error_interno') {
    if (errIntPct == null) return { nombre, metrica: c.metrica, peso, estado: 'perdido', detalle: 'sin datos' };
    const gano = c.pct_meta != null && errIntPct >= c.pct_meta;
    return { nombre, metrica: c.metrica, peso, estado: gano ? 'ganado' : 'perdido', detalle: `${errIntPct}% vs meta ${c.pct_meta ?? '—'}%` };
  }
  if (c.metrica === 'quejas') {
    const quejasPct = quejas === 0 ? 100 : 0;
    const meta = c.pct_meta ?? 100;
    const gano = quejasPct >= meta;
    return { nombre, metrica: c.metrica, peso, estado: gano ? 'ganado' : 'perdido', detalle: gano ? 'sin quejas' : `${quejas} queja(s)` };
  }
  return { nombre, metrica: c.metrica, peso, estado: 'pendiente', detalle: 'métrica no disponible' };
}

@Injectable()
export class ResultadosPagoService {
  constructor(
    private supabase: SupabaseService,
    private cumplimiento: CumplimientoService,
  ) {}

  async getResultados(
    f: FiltrosResultados,
    usuario: { sub: number; rol?: string },
  ): Promise<FilaResultado[]> {
    const filas = await this.cumplimiento.getResumen(
      { anio: f.anio, mes: f.mes, usuarioId: f.usuarioId, rol: f.rol },
      usuario,
    );

    // ── 1. Consolidar por usuario ──
    type Acc = {
      usuario: FilaResultado['usuario'];
      clientes: Map<number, string>;
      plan: ConsolidadoGlobal['plan'];
      exactitud: ConsolidadoGlobal['exactitud'];
      errores_internos: number;
      errores_cliente: number;
      quejas: number;
    };

    const porUsuario = new Map<number, Acc>();

    for (const fila of filas) {
      let acc = porUsuario.get(fila.usuario.id);
      if (!acc) {
        acc = {
          usuario: fila.usuario,
          clientes: new Map(),
          plan: { asignados: 0, evaluados: 0, cumplidos: 0, incumplidos: 0, pendientes: 0, pct: null, meta: null },
          exactitud: { asignados: 0, evaluados: 0, pendientes: 0, compromiso_total: 0, correctos_total: 0, pct: null, meta: null },
          errores_internos: 0, errores_cliente: 0, quejas: 0,
        };
        porUsuario.set(fila.usuario.id, acc);
      }
      acc.clientes.set(fila.cliente.id, fila.cliente.cliente);
      acc.plan.asignados += fila.plan.asignados;
      acc.plan.evaluados += fila.plan.evaluados;
      acc.plan.cumplidos += fila.plan.cumplidos;
      acc.plan.incumplidos += fila.plan.incumplidos;
      acc.plan.pendientes += fila.plan.pendientes;
      if (fila.plan.meta != null) acc.plan.meta = acc.plan.meta == null ? fila.plan.meta : Math.max(acc.plan.meta, fila.plan.meta);
      acc.exactitud.asignados += fila.exactitud.asignados;
      acc.exactitud.evaluados += fila.exactitud.evaluados;
      acc.exactitud.pendientes += fila.exactitud.pendientes;
      acc.exactitud.compromiso_total += fila.exactitud.compromiso_total;
      acc.exactitud.correctos_total += fila.exactitud.correctos_total;
      if (fila.exactitud.meta != null) acc.exactitud.meta = acc.exactitud.meta == null ? fila.exactitud.meta : Math.max(acc.exactitud.meta, fila.exactitud.meta);
      acc.errores_internos += fila.errores_internos;
      acc.errores_cliente += fila.errores_cliente;
      acc.quejas += fila.quejas;
    }

    // ── 2. Config + valores + casos especiales ──
    const { data: config } = await this.supabase.db
      .from('salario_variable_config')
      .select('perfil, metrica, pct_peso, pct_meta, conceptos(descripcion)')
      .eq('activo', true);
    const configRows = (config ?? []) as unknown as ConfigRow[];

    const { data: valores } = await this.supabase.db
      .from('salario_variable_valores')
      .select('usuario_id, valor')
      .eq('periodo_anio', f.anio)
      .eq('periodo_mes', f.mes)
      .eq('activo', true);
    const valorMap = new Map<number, number>(
      (valores ?? []).map((v) => [v.usuario_id as number, Number(v.valor)]),
    );

    const { data: casos } = await this.supabase.db
      .from('salario_variable_casos')
      .select('usuario_id, configuracion')
      .eq('activo', true);
    const mapaCasos = new Map<number, { usuariosFuente: number[]; componentesExcluidos: string[] }>();
    for (const c of (casos ?? []) as Array<{ usuario_id: number; configuracion: Record<string, unknown> }>) {
      const cfg = c.configuracion ?? {};
      mapaCasos.set(c.usuario_id, {
        usuariosFuente: (cfg.usuarios_fuente as number[]) ?? [],
        componentesExcluidos: (cfg.componentes_excluidos as string[]) ?? [],
      });
    }

    const redondo = (x: number) => Math.round(x * 100) / 100;
    let resultado: FilaResultado[] = [];

    // ── 3. Casos especiales: consolidación ponderada ──
    for (const [uidCaso, cfgCaso] of mapaCasos.entries()) {
      const { data: usuarioCaso } = await this.supabase.db
        .from('usuarios')
        .select('id, nombre, usuario, rol')
        .eq('id', uidCaso)
        .single();

      const fuenteIds = cfgCaso.usuariosFuente.filter((id) => id !== uidCaso);
      if (fuenteIds.length === 0) continue;

      const filasFuente: FilaCumplimiento[] = [];
      for (const fid of fuenteIds) {
        const filasF = await this.cumplimiento.getResumen(
          { anio: f.anio, mes: f.mes, usuarioId: fid },
          { sub: fid, rol: 'Analista' },
        );
        filasFuente.push(...filasF);
      }

      const plan = { asignados: 0, evaluados: 0, cumplidos: 0, incumplidos: 0, pendientes: 0 };
      const exactitud = { asignados: 0, evaluados: 0, pendientes: 0, compromiso_total: 0, correctos_total: 0 };
      let erroresInternos = 0;
      let erroresCliente = 0;
      let quejas = 0;
      const todosLosClientes = new Set<number>();
      let maxMetaPlan: number | null = null;
      let maxMetaExactitud: number | null = null;

      for (const fila of filasFuente) {
        plan.asignados += fila.plan.asignados;
        plan.evaluados += fila.plan.evaluados;
        plan.cumplidos += fila.plan.cumplidos;
        plan.incumplidos += fila.plan.incumplidos;
        plan.pendientes += fila.plan.pendientes;
        exactitud.asignados += fila.exactitud.asignados;
        exactitud.evaluados += fila.exactitud.evaluados;
        exactitud.pendientes += fila.exactitud.pendientes;
        exactitud.compromiso_total += fila.exactitud.compromiso_total;
        exactitud.correctos_total += fila.exactitud.correctos_total;
        erroresInternos += fila.errores_internos;
        erroresCliente += fila.errores_cliente;
        quejas += fila.quejas;
        todosLosClientes.add(fila.cliente.id);
        if (fila.plan.meta != null) maxMetaPlan = maxMetaPlan == null ? fila.plan.meta : Math.max(maxMetaPlan, fila.plan.meta);
        if (fila.exactitud.meta != null) maxMetaExactitud = maxMetaExactitud == null ? fila.exactitud.meta : Math.max(maxMetaExactitud, fila.exactitud.meta);
      }

      const planPct = plan.evaluados > 0 ? redondo((plan.cumplidos / plan.evaluados) * 100) : null;
      const exactPct = exactitud.compromiso_total > 0 ? redondo((exactitud.correctos_total / exactitud.compromiso_total) * 100) : null;
      const errCliPct = exactitud.compromiso_total > 0 ? redondo(((exactitud.compromiso_total - erroresCliente) / exactitud.compromiso_total) * 100) : null;
      const errIntPct = exactitud.compromiso_total > 0 ? redondo(((exactitud.compromiso_total - erroresInternos) / exactitud.compromiso_total) * 100) : null;

      const consolidado: ConsolidadoGlobal = {
        plan: { ...plan, pct: planPct, meta: maxMetaPlan },
        exactitud: { ...exactitud, pct: exactPct, meta: maxMetaExactitud },
        error_cliente: erroresCliente,
        error_interno: erroresInternos,
        quejas,
      };

      const perfil = (usuarioCaso?.rol === 'Lider') ? 'Lider' : 'Analista';
      const componentes = configRows
        .filter((c) => c.perfil === perfil)
        .filter((c) => !cfgCaso.componentesExcluidos.includes(c.metrica ?? ''))
        .map((c) => evaluarComponente(c, planPct, exactPct, errCliPct, errIntPct, quejas, maxMetaPlan, maxMetaExactitud));

      const pctFinal = redondo(componentes.filter((c) => c.estado === 'ganado').reduce((s, c) => s + c.peso, 0));
      const valorBase = valorMap.get(uidCaso) ?? null;
      const valorAPagar = valorBase != null ? Math.round((valorBase * pctFinal) / 100) : null;

      resultado.push({
        usuario: {
          id: uidCaso,
          nombre: (usuarioCaso as { nombre: string })?.nombre ?? `#${uidCaso}`,
          usuario: (usuarioCaso as { usuario: string })?.usuario ?? '',
          rol: (usuarioCaso as { rol: string })?.rol ?? 'Analista',
        },
        periodo: { anio: f.anio, mes: f.mes },
        clientes: [...todosLosClientes].map((id) => ({ id, cliente: `#${id}` })),
        valor_base: valorBase,
        consolidado,
        componentes,
        pct_final: pctFinal,
        valor_a_pagar: valorAPagar,
        caso_especial: true,
      });
    }

    // ── 4. Usuarios estándar ──
    for (const acc of porUsuario.values()) {
      if (mapaCasos.has(acc.usuario.id)) continue;

      acc.plan.pct = acc.plan.evaluados > 0
        ? redondo((acc.plan.cumplidos / acc.plan.evaluados) * 100)
        : null;
      acc.exactitud.pct = acc.exactitud.compromiso_total > 0
        ? redondo((acc.exactitud.correctos_total / acc.exactitud.compromiso_total) * 100)
        : null;

      const errorClientePct = acc.exactitud.compromiso_total > 0
        ? redondo(((acc.exactitud.compromiso_total - acc.errores_cliente) / acc.exactitud.compromiso_total) * 100)
        : null;
      const errorInternoPct = acc.exactitud.compromiso_total > 0
        ? redondo(((acc.exactitud.compromiso_total - acc.errores_internos) / acc.exactitud.compromiso_total) * 100)
        : null;

      const perfil = acc.usuario.rol === 'Lider' ? 'Lider' : 'Analista';
      const componentes = configRows
        .filter((c) => c.perfil === perfil)
        .map((c) => evaluarComponente(c, acc.plan.pct, acc.exactitud.pct, errorClientePct, errorInternoPct, acc.quejas, acc.plan.meta, acc.exactitud.meta));

      const pctFinal = redondo(componentes.filter((c) => c.estado === 'ganado').reduce((s, c) => s + c.peso, 0));
      const valorBase = valorMap.get(acc.usuario.id) ?? null;
      const valorAPagar = valorBase != null ? Math.round((valorBase * pctFinal) / 100) : null;

      if (f.clienteId && !acc.clientes.has(f.clienteId)) continue;

      resultado.push({
        usuario: acc.usuario,
        periodo: { anio: f.anio, mes: f.mes },
        clientes: [...acc.clientes.entries()].map(([id, cliente]) => ({ id, cliente })),
        valor_base: valorBase,
        consolidado: {
          plan: acc.plan,
          exactitud: acc.exactitud,
          error_cliente: acc.errores_cliente,
          error_interno: acc.errores_internos,
          quejas: acc.quejas,
        },
        componentes,
        pct_final: pctFinal,
        valor_a_pagar: valorAPagar,
        caso_especial: false,
      });
    }

    // Admin ve todo; líder y analista ven solo su propia fila de resultados.
    if (usuario?.rol && usuario.rol !== 'Admin') {
      resultado = resultado.filter((r) => r.usuario.id === usuario.sub);
    }

    resultado.sort((a, b) => a.usuario.nombre.localeCompare(b.usuario.nombre));
    return resultado;
  }
}
