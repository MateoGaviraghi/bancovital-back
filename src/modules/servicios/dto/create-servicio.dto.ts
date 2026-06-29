import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServicioDto {
  @ApiProperty({ description: 'Nombre del servicio, ej: "Humana", "Veterinaria", "Agua y efluentes"' })
  @IsString()
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ required: false, description: 'Slug URL-safe. Si no se envía, se genera del nombre.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @ApiProperty({ required: false, description: 'Nombre del ícono lucide (ej: "stethoscope", "paw-print")' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  icono?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaPacienteHumano?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaPacienteAnimal?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaMedico?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaVeterinario?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaPropietario?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaSolicitanteAgua?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  usaMuestraAgua?: boolean;

  @ApiProperty({ required: false, description: 'Configuración del formulario dinámico (secciones y campos)' })
  @IsOptional()
  @IsObject()
  formConfig?: Record<string, unknown>;
}
