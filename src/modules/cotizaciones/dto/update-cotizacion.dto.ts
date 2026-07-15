import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CotizacionItemInputDto } from './create-cotizacion.dto';

export class UpdateCotizacionDto {
  @IsOptional()
  @IsIn(['borrador', 'enviada', 'aceptada', 'rechazada', 'expirada'])
  estado?: 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'expirada';

  @IsOptional()
  @IsInt()
  @Min(1)
  validezDias?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  /** 0 = Particular (null), >0 = obra social */
  @IsOptional()
  @IsInt()
  @Min(0)
  insurerId?: number;

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
  @IsNumber()
  @Min(0)
  @Max(100)
  copagoPorc?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CotizacionItemInputDto)
  items?: CotizacionItemInputDto[];
}
