import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePacienteAnimalDto {
  @ApiProperty()
  @IsInt()
  propietarioId!: number;

  @ApiProperty()
  @IsInt()
  especieId!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  razaId?: number;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  nombre!: string;

  @ApiProperty({ required: false, nullable: true, enum: ['macho', 'hembra', 'indeterminado'] })
  @IsOptional()
  @IsEnum(['macho', 'hembra', 'indeterminado'])
  sexo?: 'macho' | 'hembra' | 'indeterminado';

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ required: false, nullable: true, description: 'Decimal number as string, e.g. 12.50' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'peso must be a valid decimal number' })
  peso?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tamanio?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['entero', 'castrado', 'esterilizado', 'gestante', 'lactante', 'desconocido'],
  })
  @IsOptional()
  @IsEnum(['entero', 'castrado', 'esterilizado', 'gestante', 'lactante', 'desconocido'])
  estadoReproductivo?: 'entero' | 'castrado' | 'esterilizado' | 'gestante' | 'lactante' | 'desconocido';

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  microchip?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
