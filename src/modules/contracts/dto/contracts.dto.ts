import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PropuestaDto {
  @ApiProperty({ description: 'Descripción de la propuesta' })
  @IsString()
  descripcion!: string;

  @ApiPropertyOptional({ description: 'Notas adicionales' })
  @IsOptional()
  @IsString()
  notas?: string;
}

export class CreateContractDto {
  @ApiProperty({ description: 'Razón social del cliente' })
  @IsString()
  @IsNotEmpty()
  razonSocial!: string;

  @ApiProperty({ description: 'Nombre del contacto / representante' })
  @IsString()
  @IsNotEmpty()
  nombreContacto!: string;

  @ApiPropertyOptional({ description: 'CUIT' })
  @IsOptional()
  @IsString()
  cuit?: string;

  @ApiProperty({ description: 'Email del firmante', format: 'email' })
  @IsEmail()
  emailFirmante!: string;

  @ApiPropertyOptional({ description: 'Teléfono' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ type: PropuestaDto })
  @ValidateNested()
  @Type(() => PropuestaDto)
  propuesta!: PropuestaDto;

  @ApiPropertyOptional({ description: 'ID del plan sugerido' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  planSugeridoId?: number;
}

export class RequestOtpDto {}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Código OTP de 6 dígitos' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  codigo!: string;
}

export class DatosFacturacionDto {
  @ApiProperty({ description: 'Domicilio fiscal' })
  @IsString()
  @IsNotEmpty()
  domicilioFiscal!: string;

  @ApiPropertyOptional({ description: 'CUIT' })
  @IsOptional()
  @IsString()
  cuit?: string;

  @ApiPropertyOptional({ description: 'Condición IVA' })
  @IsOptional()
  @IsString()
  condicionIva?: string;
}

export class SignContractDto {
  @ApiProperty({ description: 'ID del plan elegido' })
  @IsInt()
  @IsPositive()
  planId!: number;

  @ApiProperty({ description: 'Firma en base64 (data:image/png;base64,...)', maxLength: 700000 })
  @IsString()
  @IsNotEmpty()
  firmaDataUrl!: string;

  @ApiProperty({ type: DatosFacturacionDto })
  @ValidateNested()
  @Type(() => DatosFacturacionDto)
  datosFacturacion!: DatosFacturacionDto;

  @ApiProperty({ description: 'Debe ser true', type: Boolean })
  @Equals(true, { message: 'Debe aceptar los términos del contrato' })
  aceptaTerminos!: true;
}
