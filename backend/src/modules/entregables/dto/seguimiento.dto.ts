import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Datos que se capturan al hacer seguimiento a un entregable.
 * Los errores NO se capturan aquí: viven en la tabla hija entregable_errores.
 */
export class SeguimientoEntregableDto {
  /** Fecha real de entrega. Dispara el cálculo de puntualidad. */
  @IsOptional() @IsDateString()
  resultado?: string;

  /** Permite corregir la fecha pactada durante el seguimiento. */
  @IsOptional() @IsDateString()
  fecha_compromiso?: string;

  /** Cantidad pactada. Alternativa a fecha. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  cantidad_compromiso?: number;

  /** Cantidad PROCESADA para entregables por cantidad. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  resultado_cantidad?: number;

  @IsOptional() @IsBoolean()
  aprobado?: boolean;

  @IsOptional() @Type(() => Number) @IsInt()
  estatus_id?: number;

  @IsOptional() @IsString()
  comentarios?: string;
}
