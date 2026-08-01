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
}
