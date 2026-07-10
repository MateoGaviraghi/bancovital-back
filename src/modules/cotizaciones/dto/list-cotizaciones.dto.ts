import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListCotizacionesDto {
  @IsOptional()
  @IsIn(['borrador', 'enviada', 'aceptada', 'rechazada', 'expirada'])
  estado?: string;

  @IsOptional()
  @IsIn(['paciente', 'empresa'])
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pageSize?: number;
}
