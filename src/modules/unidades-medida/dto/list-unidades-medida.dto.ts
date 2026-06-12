import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const STATUS = ['all', 'active', 'inactive'] as const;
export type UnidadStatus = (typeof STATUS)[number];

export class ListUnidadesMedidaDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre (ILIKE)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: STATUS, default: 'active' })
  @IsOptional()
  @IsIn(STATUS)
  status?: UnidadStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
