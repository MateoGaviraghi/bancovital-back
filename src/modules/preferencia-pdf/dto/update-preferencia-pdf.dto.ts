import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

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
}

export class UpdatePreferenciaPdfDto {
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
