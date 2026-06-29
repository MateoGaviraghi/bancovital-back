import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const STATUSES = [
  'borrador',
  'confirmada',
  'en_proceso',
  'resultados_cargados',
  'emitida',
  'entregada',
  'anulada',
] as const;
type OrderStatusEnum = (typeof STATUSES)[number];

export class ListOrdersDto {
  @ApiPropertyOptional({
    enum: STATUSES,
    isArray: true,
    description: 'Repetir param para multiple (?status=borrador&status=confirmada)',
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value !== undefined ? [value] : undefined,
  )
  @IsArray()
  @IsIn(STATUSES, { each: true })
  status?: OrderStatusEnum[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  insurerId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por servicio' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  servicioId?: number;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Busqueda en paciente o protocolo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
