import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAnuncioDto {
  @ApiProperty({ example: 'Mantenimiento programado el domingo' })
  @IsString()
  @MinLength(3)
  mensaje!: string;

  @ApiPropertyOptional({ enum: ['info', 'advertencia', 'mantenimiento'], default: 'info' })
  @IsOptional()
  @IsIn(['info', 'advertencia', 'mantenimiento'])
  tipo?: 'info' | 'advertencia' | 'mantenimiento';

  @ApiPropertyOptional({ example: 1, description: 'ID del lab destino; null/omitido = global' })
  @IsOptional()
  @IsInt()
  @Min(1)
  labId?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  hasta?: string;
}

export class UpdateAnuncioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  mensaje?: string;

  @ApiPropertyOptional({ enum: ['info', 'advertencia', 'mantenimiento'] })
  @IsOptional()
  @IsIn(['info', 'advertencia', 'mantenimiento'])
  tipo?: 'info' | 'advertencia' | 'mantenimiento';

  @ApiPropertyOptional({ description: 'ID del lab destino; null = global' })
  @IsOptional()
  @IsInt()
  @Min(1)
  labId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  desde?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  hasta?: string | null;
}
