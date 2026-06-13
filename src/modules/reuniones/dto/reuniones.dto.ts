import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GetAvailabilityQueryDto {
  @ApiProperty({
    description: 'Fecha en formato YYYY-MM-DD',
    example: '2025-03-10',
  })
  @IsDateString({}, { message: 'date debe ser una fecha válida en formato YYYY-MM-DD' })
  date!: string;
}

export class CreateReunionDto {
  @ApiProperty({ description: 'Nombre completo del solicitante', minLength: 2 })
  @IsString()
  @MinLength(2)
  nombre!: string;

  @ApiProperty({ description: 'Email de contacto', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Empresa / organización' })
  @IsOptional()
  @IsString()
  empresa?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ description: 'Mensaje o motivo de la reunión', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mensaje?: string;

  @ApiProperty({
    description: 'Inicio del slot elegido (ISO 8601, ej. 2025-03-10T13:00:00.000Z)',
  })
  @IsISO8601({}, { message: 'slotInicio debe ser una fecha ISO 8601 válida' })
  @IsNotEmpty()
  slotInicio!: string;
}
