import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUnidadMedidaDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 20 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value,
  )
  @IsString()
  @MaxLength(20)
  simbolo?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Opciones predeterminadas para select (ej ["Amarillo", "Ámbar", "Rojizo"])',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  opcionesPredeterminadas?: string[] | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 200, description: 'Metodología analítica (ej "Fotometría", "Inmunoturbidimetría")' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? (value.trim() || null) : value))
  @IsString()
  @MaxLength(200)
  metodologia?: string | null;
}
