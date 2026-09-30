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

@Injectable()
export class ResultadosPagoService {
  constructor(
    private supabase: SupabaseService,
    private cumplimiento: CumplimientoService,
  ) {}

  /**
   * Resultado económico por usuario y período.
   *
   * 1. Toma las filas de Cumplimiento (usuario+cliente) y las consolida
   *    GLOBALMENTE por usuario (todos sus clientes sumados).
   * 2. Evalúa cada componente configurado del perfil de forma independiente:
   *    gana el peso si cumple la meta (la más exigente de sus clientes).
   * 3. % final = suma de pesos ganados; valor a pagar = valor base × % final.
   *
   * No persiste nada: siempre se recalcula desde Cumplimiento + configuración.
   * Extensión preparada: usuarios con caso especial activo se marcan para
   * aplicar reglas personalizadas en fases futuras.
   */
  async getResultados(
    f: FiltrosResultados,
    usuario: { sub: number; rol?: string },
  ): Promise<FilaResultado[]> {
    // ── 1. Filas de cumplimiento (sin filtro de cliente: consolidación global) ──
    const filas = await this.cumplimiento.getResumen(
      { anio: f.anio, mes: f.mes, usuarioId: f.usuarioId, rol: f.rol },
      usuario,
    );

    // ── 2. Consolidación global por usuario ──
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
          plan: {
            asignados: 0, evaluados: 0, cumplidos: 0, incumplidos: 0, pendientes: 0,
            pct: null, meta: null,
          },
          exactitud: {
            asignados: 0, evaluados: 0, pendientes: 0,
            compromiso_total: 0, correctos_total: 0, pct: null, meta: null,
          },
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
      // Meta global = la más exigente de sus clientes.
      if (fila.plan.meta != null) {
        acc.plan.meta = acc.plan.meta == null ? fila.plan.meta : Math.max(acc.plan.meta, fila.plan.meta);
      }

      acc.exactitud.asignados += fila.exactitud.asignados;
      acc.exactitud.evaluados += fila.exactitud.evaluados;
      acc.exactitud.pendientes += fila.exactitud.pendientes;
      acc.exactitud.compromiso_total += fila.exactitud.compromiso_total;
      acc.exactitud.correctos_total += fila.exactitud.correctos_total;
      if (fila.exactitud.meta != null) {
        acc.exactitud.meta = acc.exactitud.meta == null
          ? fila.exactitud.meta
          : Math.max(acc.exactitud.meta, fila.exactitud.meta);
      }

      acc.errores_internos += fila.errores_internos;
      acc.errores_cliente += fila.errores_cliente;
      acc.quejas += fila.quejas;
    }

    // ── 3. Porcentajes de error: (compromiso - errores) / compromiso vs meta ──
    // error_cliente %: proporción de procesos libres de error de cliente
    // error_interno %: proporción de procesos libres de error interno

    // ── 3. Configuración por perfil + valores del período + casos especiales ──
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

    // Extensión: casos especiales (por ahora solo se marcan).
    const { data: casos } = await this.supabase.db
      .from('salario_variable_casos')
      .select('usuario_id')
      .eq('activo', true);
    const conCaso = new Set((casos ?? []).map((c) => c.usuario_id as number));

    // ── 4. Evaluación de componentes y liquidación ──
    const redondo = (x: number) => Math.round(x * 100) / 100;
    const resultado: FilaResultado[] = [];

    for (const acc of porUsuario.values()) {
      acc.plan.pct = acc.plan.evaluados > 0
        ? redondo((acc.plan.cumplidos / acc.plan.evaluados) * 100)
        : null;
      acc.exactitud.pct = acc.exactitud.compromiso_total > 0
        ? redondo((acc.exactitud.correctos_total / acc.exactitud.compromiso_total) * 100)
        : null;

      // Porcentajes basados en errores: procesos sin error / total procesos
      const errorClientePct = acc.exactitud.compromiso_total > 0
        ? redondo(((acc.exactitud.compromiso_total - acc.errores_cliente) / acc.exactitud.compromiso_total) * 100)
        : null;
      const errorInternoPct = acc.exactitud.compromiso_total > 0
        ? redondo(((acc.exactitud.compromiso_total - acc.errores_internos) / acc.exactitud.compromiso_total) * 100)
        : null;

      const perfil = acc.usuario.rol === 'Lider' ? 'Lider' : 'Analista';

      const componentes: ComponentePago[] = configRows
        .filter((c) => c.perfil === perfil)
        .map((c) => {
          const peso = c.pct_peso ?? 0;
          const nombre = c.conceptos?.descripcion ?? '—';

          if (c.metrica === 'plan') {
            if (acc.plan.pct == null) {
              return { nombre, metrica: c.metrica, peso, estado: 'perdido' as const, detalle: 'sin entregables evaluados' };
            }
            const gano = acc.plan.meta != null && acc.plan.pct >= acc.plan.meta;
            return {
              nombre, metrica: c.metrica, peso,
              estado: gano ? 'ganado' as const : 'perdido' as const,
              detalle: `${acc.plan.pct}% vs meta ${acc.plan.meta ?? '—'}%`,
            };
          }
          if (c.metrica === 'exactitud') {
            if (acc.exactitud.pct == null) {
              return { nombre, metrica: c.metrica, peso, estado: 'perdido' as const, detalle: 'sin procesos evaluados' };
            }
            const gano = acc.exactitud.meta != null && acc.exactitud.pct >= acc.exactitud.meta;
            return {
              nombre, metrica: c.metrica, peso,
              estado: gano ? 'ganado' as const : 'perdido' as const,
              detalle: `${acc.exactitud.pct}% vs meta ${acc.exactitud.meta ?? '—'}%`,
            };
          }
          if (c.metrica === 'error_cliente') {
            if (errorClientePct == null) {
              return { nombre, metrica: c.metrica, peso, estado: 'perdido' as const, detalle: 'sin procesos evaluados' };
            }
            const gano = c.pct_meta != null && errorClientePct >= c.pct_meta;
            return {
              nombre, metrica: c.metrica, peso,
              estado: gano ? 'ganado' as const : 'perdido' as const,
              detalle: `${errorClientePct}% (sin error cliente) vs meta ${c.pct_meta ?? '—'}%`,
            };
          }
          if (c.metrica === 'error_interno') {
            if (errorInternoPct == null) {
              return { nombre, metrica: c.metrica, peso, estado: 'perdido' as const, detalle: 'sin procesos evaluados' };
            }
            const gano = c.pct_meta != null && errorInternoPct >= c.pct_meta;
            return {
              nombre, metrica: c.metrica, peso,
              estado: gano ? 'ganado' as const : 'perdido' as const,
              detalle: `${errorInternoPct}% (sin error interno) vs meta ${c.pct_meta ?? '—'}%`,
            };
          }
          if (c.metrica === 'quejas') {
            // Meta 100% por defecto: si hay al menos una queja, el % es 0 → se pierde.
            const quejasPct = acc.quejas === 0 ? 100 : 0;
            const meta = c.pct_meta ?? 100;
            const gano = quejasPct >= meta;
            return {
              nombre, metrica: c.metrica, peso,
              estado: gano ? 'ganado' as const : 'perdido' as const,
              detalle: gano ? 'sin quejas en el período' : `${acc.quejas} queja(s) en el período`,
            };
          }
          // Métrica aún no disponible (concepto configurado sin motor).
          return { nombre, metrica: c.metrica, peso, estado: 'pendiente' as const, detalle: 'métrica no disponible aún' };
        });

      const pctFinal = redondo(
        componentes.filter((c) => c.estado === 'ganado').reduce((s, c) => s + c.peso, 0),
      );

      const valorBase = valorMap.get(acc.usuario.id) ?? null;
      const valorAPagar = valorBase != null ? Math.round((valorBase * pctFinal) / 100) : null;

      // Filtro por cliente: solo usuarios con operación en ese cliente
      // (la consolidación sigue siendo global).
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
        caso_especial: conCaso.has(acc.usuario.id),
      });
    }

    resultado.sort((a, b) => a.usuario.nombre.localeCompare(b.usuario.nombre));
    return resultado;
  }
}
