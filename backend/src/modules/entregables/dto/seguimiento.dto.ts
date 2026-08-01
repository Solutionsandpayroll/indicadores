import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min,
} from 'class-validator';

/**
 * Datos que se capturan al hacer seguimiento a un entregable
 * (típicamente al pasarlo a "Terminado").
 */
export class SeguimientoEntregableDto {
  /** Fecha real de entrega. Dispara el cálculo de cumplimiento. */
  @IsOptional() @IsDateString()
  resultado?: string;

  /** Permite corregir la fecha pactada durante el seguimiento. */
  @IsOptional() @IsDateString()
  fecha_compromiso?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  error_interno?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  error_cliente?: number;

  @IsOptional() @IsBoolean()
  aprobado?: boolean;

  @IsOptional() @Type(() => Number) @IsInt()
  estatus_id?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  pct_avance?: number;

  @IsOptional() @IsString()
  comentarios?: string;
}
