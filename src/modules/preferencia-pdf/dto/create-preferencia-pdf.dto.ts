import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const TIPOS_PDF = ['informe', 'orden'] as const;
export type TipoPdf = (typeof TIPOS_PDF)[number];

export class CreatePreferenciaPdfDto {
  @ApiProperty({
    example: 'Membrete institucional',
    description: 'Nombre descriptivo del formato de impresión.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({
    example: 'informe',
    enum: TIPOS_PDF,
    default: 'informe',
    description: "Tipo de documento al que aplica: 'informe' (resultados) u 'orden' (ficha de trabajo).",
    required: false,
  })
  @IsOptional()
  @IsIn(TIPOS_PDF)
  tipo?: TipoPdf;

  @ApiProperty({ required: false, description: 'ID del servicio al que aplica este formato' })
  @IsOptional()
  @IsInt()
  @Min(1)
  servicioId?: number;
}
