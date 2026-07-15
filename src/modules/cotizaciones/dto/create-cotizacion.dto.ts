import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CotizacionItemInputDto {
  @IsOptional()
  @IsInt()
  practiceId?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  practicaNombre!: string;

  @IsNumberString()
  precioUnitario!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsInt()
  @IsOptional()
  sort?: number;
}

export class CreateCotizacionDto {
  @IsIn(['paciente', 'empresa', 'generica'])
  tipo!: 'paciente' | 'empresa' | 'generica';

  @IsOptional()
  @IsInt()
  patientId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empresaNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  empresaCuit?: string;

  @IsOptional()
  @IsEmail()
  empresaEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  empresaTelefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  empresaContacto?: string;

  @IsOptional()
  @IsInt()
  insurerId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  validezDias?: number;

  /** Porcentaje de copago a cargo del paciente, ej: 20 = 20%. NULL = OS cubre 100%. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  copagoPorc?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotizacionItemInputDto)
  items!: CotizacionItemInputDto[];
}
