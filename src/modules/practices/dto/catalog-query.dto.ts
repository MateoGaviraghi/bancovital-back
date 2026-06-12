import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const STATUS = ['all', 'active', 'inactive'] as const;
export type CatalogStatus = (typeof STATUS)[number];

export class CatalogQueryDto {
  @ApiPropertyOptional({ description: 'Busqueda por nombre o codigo NBU' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por seccion exacta' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string;

  @ApiPropertyOptional({ enum: STATUS, default: 'all' })
  @IsOptional()
  @IsIn(STATUS)
  status?: CatalogStatus;

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
