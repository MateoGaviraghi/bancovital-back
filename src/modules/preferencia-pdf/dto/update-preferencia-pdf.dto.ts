import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TIPOS_PDF, type TipoPdf } from './create-preferencia-pdf.dto';

export class PdfLayoutCampoDto {
  @ApiProperty({ example: 120 })
  @IsInt()
  @Min(0)
  @Max(2000)
  x!: number;

  @ApiProperty({ example: 240 })
  @IsInt()
  @Min(0)
  @Max(2000)
  y!: number;

  @ApiProperty({ required: false, example: 12 })
  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(72)
  fontSize?: number;

  @ApiProperty({ required: false, example: '#000000' })
  @IsOptional()
  color?: string;

  @ApiProperty({ required: false, example: 'Nombre: ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prefix?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  bold?: boolean;

  @ApiProperty({ required: false, example: '#f5f0e8' })
  @IsOptional()
  @IsString()
  headerBg?: string;

  @ApiProperty({ required: false, example: '#5a4a2f' })
  @IsOptional()
  @IsString()
  headerColor?: string;

  @ApiProperty({ required: false, example: '#d4c9b0' })
  @IsOptional()
  @IsString()
  borderColor?: string;

  @ApiProperty({ required: false, example: '#000000' })
  @IsOptional()
  @IsString()
  rowColor?: string;
}

export class UpdatePreferenciaPdfDto {
  @ApiProperty({ required: false, example: 'Membrete institucional' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @ApiProperty({ required: false, enum: TIPOS_PDF })
  @IsOptional()
  @IsIn(TIPOS_PDF)
  tipo?: TipoPdf;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Dibujar la imagen de fondo (membrete) en el PDF.',
  })
  @IsOptional()
  @IsBoolean()
  usarFondo?: boolean;

  @ApiProperty({
    required: false,
    description: 'Mapa de campos sobre la imagen de fondo. Clave = "entidad.campo"',
    example: { 'paciente.nombre': { x: 120, y: 240, fontSize: 12 } },
  })
  @IsOptional()
  @IsObject()
  campos?: Record<string, PdfLayoutCampoDto>;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  marginTop?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  marginBottom?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  marginLeft?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  marginRight?: number;
}
