import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AssociateUnidadDto {
  @ApiProperty({ description: 'Id de la unidad de medida a asociar a la práctica' })
  @IsInt()
  @Min(1)
  unidadId!: number;

  @ApiPropertyOptional({
    description: 'Orden de aparición en el form y en el PDF. Default 0.',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Límite inferior del rango de referencia', nullable: true })
  @IsOptional()
  @IsNumberString()
  rangeLow?: string | null;

  @ApiPropertyOptional({ description: 'Límite superior del rango de referencia', nullable: true })
  @IsOptional()
  @IsNumberString()
  rangeHigh?: string | null;

  @ApiPropertyOptional({ description: 'Texto libre de referencia', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceText?: string | null;
}
