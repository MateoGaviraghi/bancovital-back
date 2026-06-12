import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUnidadMedidaDto {
  @ApiProperty({ description: 'Nombre de la unidad (ej "pH", "Color", "mg/dL")', maxLength: 80 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Símbolo opcional para imprimir junto al valor (ej "mg/dL", "%", "U/L")',
    maxLength: 20,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(20)
  simbolo?: string;
}
