import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class StatsService {
  constructor(private supabase: SupabaseService) {}

  async getOverview() {
    const [clientes, entregables, indicadores] = await Promise.all([
      this.supabase.db.from('clientes').select('*', { count: 'exact', head: true }).eq('mostrar', true),
      this.supabase.db.from('entregables').select('*', { count: 'exact', head: true }),
      this.supabase.db.from('indicadores').select('*', { count: 'exact', head: true }).eq('mostrar', true),
    ]);

    if (clientes.error) throw new InternalServerErrorException(clientes.error.message);
    if (entregables.error) throw new InternalServerErrorException(entregables.error.message);
    if (indicadores.error) throw new InternalServerErrorException(indicadores.error.message);

    return {
      clientes: clientes.count ?? 0,
      entregables: entregables.count ?? 0,
      indicadores: indicadores.count ?? 0,
    };
  }

  async getTrends() {
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const startDate = new Date(Date.UTC(months[0].year, months[0].month - 1, 1)).toISOString();

    const [clientesRes, indicadoresRes, entregablesRes] = await Promise.all([
      this.supabase.db.from('clientes').select('creado_en').gte('creado_en', startDate),
      this.supabase.db.from('indicadores').select('creado_en').gte('creado_en', startDate),
      this.supabase.db.from('entregables').select('mes, anio')
        .gte('anio', months[0].year)
        .lte('anio', months[11].year),
    ]);

    if (clientesRes.error) throw new InternalServerErrorException(clientesRes.error.message);
    if (indicadoresRes.error) throw new InternalServerErrorException(indicadoresRes.error.message);
    if (entregablesRes.error) throw new InternalServerErrorException(entregablesRes.error.message);

    const aggregateByMonth = (
      records: { creado_en?: string; mes?: number; anio?: number }[],
      getKey: (r: { creado_en?: string; mes?: number; anio?: number }) => string,
    ) => {
      const map = new Map<string, number>();
      for (const r of records) map.set(getKey(r), (map.get(getKey(r)) ?? 0) + 1);
      return months.map((m) => map.get(`${m.year}-${String(m.month).padStart(2, '0')}`) ?? 0);
    };

    const clientesTrend = aggregateByMonth(clientesRes.data ?? [], (r) => {
      const d = new Date(r.creado_en!);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const indicadoresTrend = aggregateByMonth(indicadoresRes.data ?? [], (r) => {
      const d = new Date(r.creado_en!);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const entregablesTrend = aggregateByMonth(
      (entregablesRes.data ?? []).filter(
        (e) =>
          months.some((m) => m.year === e.anio && m.month === e.mes),
      ),
      (r) => `${r.anio}-${String(r.mes).padStart(2, '0')}`,
    );

    const calcGrowth = (arr: number[]) => {
      const last = arr.slice(-3).reduce((a, b) => a + b, 0) / 3 || 0;
      const prev = arr.slice(-6, -3).reduce((a, b) => a + b, 0) / 3 || 1;
      return Math.round(((last - prev) / prev) * 100);
    };

    return {
      clientes: clientesTrend,
      entregables: entregablesTrend,
      indicadores: indicadoresTrend,
      crecimiento: {
        clientes: calcGrowth(clientesTrend),
        entregables: calcGrowth(entregablesTrend),
        indicadores: calcGrowth(indicadoresTrend),
      },
    };
  }
}
