import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Filtros dinámicos de la pestaña Entregables.
 * Todos son opcionales y se combinan entre sí (AND).
 */
export class FiltrarEntregablesDto {
  @IsOptional() @Type(() => Number) @IsInt()
  cliente_id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  indicador_id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  estatus_id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  lider_id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  usuario_id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  entregable_tipo_id?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000)
  anio?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  mes?: number;

  // ── Rango de período: desde mes/año hasta mes/año ──
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000)
  anio_desde?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  mes_desde?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(2000)
  anio_hasta?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  mes_hasta?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  aprobado?: boolean;

  /** Búsqueda libre sobre comentarios y tipo. */
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsIn(['periodo', 'cliente', 'estatus', 'cumplimiento', 'id'])
  orden?: 'periodo' | 'cliente' | 'estatus' | 'cumplimiento' | 'id';

  @IsOptional() @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';
}
