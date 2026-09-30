import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface SalarioVariableConfig {
  id: number; perfil: string; concepto_id: number; pct_meta: number;
  pct_peso: number; activo: boolean; creado_en: string; actualizado_en: string;
  concepto?: { descripcion: string };
}

export interface SalarioVariableValor {
  id: number; usuario_id: number; valor: number; periodo_anio: number;
  periodo_mes: number; vigencia_desde: string; vigencia_hasta: string | null;
  activo: boolean; creado_en: string; actualizado_en: string;
  usuario?: { nombre: string; usuario: string };
}

export interface SalarioVariableCaso {
  id: number; usuario_id: number; descripcion: string; tipo_regla: string;
  configuracion: Record<string, unknown>; activo: boolean;
  creado_en: string; actualizado_en: string;
  usuario?: { nombre: string; usuario: string };
}

export interface SalarioVariableResultado {
  id: number; usuario_id: number; periodo_anio: number; periodo_mes: number;
  pct_cumplimiento: number | null; errores_internos: number;
  errores_cliente: number; quejas: number; pct_final: number | null;
  valor_asignado: number | null; valor_a_pagar: number | null;
  calculado_en: string;
  usuario?: { nombre: string; usuario: string };
}

@Injectable()
export class SalarioVariableAdminService {
  constructor(private supabase: SupabaseService) {}

  // ---- SECCIÓN 1: Configuración por Perfil ----
  async getConfig() {
    const { data, error } = await this.supabase.db
      .from('salario_variable_config')
      .select('*, conceptos(descripcion)')
      .order('perfil');
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableConfig[];
  }

  async createConfig(dto: Partial<SalarioVariableConfig>) {
    const { data, error } = await this.supabase.db
      .from('salario_variable_config')
      .insert(dto as never)
      .select('*, conceptos(descripcion)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableConfig;
  }

  async updateConfig(id: number, dto: Partial<SalarioVariableConfig>) {
    const { data, error } = await this.supabase.db
      .from('salario_variable_config')
      .update({ ...dto, actualizado_en: new Date().toISOString() } as never)
      .eq('id', id)
      .select('*, conceptos(descripcion)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableConfig;
  }

  async deleteConfig(id: number) {
    const { error } = await this.supabase.db.from('salario_variable_config').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Configuración ${id} eliminada` };
  }

  // ---- SECCIÓN 2: Valores de Variable ----
  async getValores(anio?: number, mes?: number) {
    let query = this.supabase.db
      .from('salario_variable_valores')
      .select('*, usuario:usuarios(nombre, usuario)')
      .order('periodo_anio', { ascending: false })
      .order('periodo_mes', { ascending: false });

    if (anio) query = query.eq('periodo_anio', anio);
    if (mes) query = query.eq('periodo_mes', mes);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableValor[];
  }

  async createValor(dto: Partial<SalarioVariableValor>) {
    const { data, error } = await this.supabase.db
      .from('salario_variable_valores')
      .insert(dto as never)
      .select('*, usuario:usuarios(nombre, usuario)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableValor;
  }

  async updateValor(id: number, dto: Partial<SalarioVariableValor>) {
    const { data: old } = await this.supabase.db
      .from('salario_variable_valores')
      .select('valor').eq('id', id).single();

    const { data, error } = await this.supabase.db
      .from('salario_variable_valores')
      .update({ ...dto, actualizado_en: new Date().toISOString() } as never)
      .eq('id', id)
      .select('*, usuario:usuarios(nombre, usuario)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);

    // Registrar historial si cambió el valor
    if (dto.valor !== undefined && old && old.valor !== dto.valor) {
      await this.supabase.db.from('salario_variable_valores_hist').insert({
        valor_id: id,
        valor_anterior: old.valor,
        valor_nuevo: dto.valor,
      } as never);
    }

    return data as unknown as SalarioVariableValor;
  }

  async deleteValor(id: number) {
    const { error } = await this.supabase.db.from('salario_variable_valores').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Valor ${id} eliminado` };
  }

  async getHistorial(valorId: number) {
    const { data, error } = await this.supabase.db
      .from('salario_variable_valores_hist')
      .select('*')
      .eq('valor_id', valorId)
      .order('modificado_en', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }

  // ---- SECCIÓN 3: Casos Especiales ----
  async getCasos() {
    const { data, error } = await this.supabase.db
      .from('salario_variable_casos')
      .select('*, usuario:usuarios(nombre, usuario)')
      .order('id');
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableCaso[];
  }

  async createCaso(dto: Partial<SalarioVariableCaso>) {
    const { data, error } = await this.supabase.db
      .from('salario_variable_casos')
      .insert(dto as never)
      .select('*, usuario:usuarios(nombre, usuario)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableCaso;
  }

  async updateCaso(id: number, dto: Partial<SalarioVariableCaso>) {
    const { data, error } = await this.supabase.db
      .from('salario_variable_casos')
      .update({ ...dto, actualizado_en: new Date().toISOString() } as never)
      .eq('id', id)
      .select('*, usuario:usuarios(nombre, usuario)')
      .single();
    if (error) throw new InternalServerErrorException(error.message);
    return data as unknown as SalarioVariableCaso;
  }

  async deleteCaso(id: number) {
    const { error } = await this.supabase.db.from('salario_variable_casos').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
    return { message: `Caso ${id} eliminado` };
  }
}
