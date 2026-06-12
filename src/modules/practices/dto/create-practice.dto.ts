import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePracticeDto {
  @ApiProperty({ example: '10201' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nbuCode!: string;

  @ApiProperty({ example: 'Hemograma completo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Hemograma', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @ApiPropertyOptional({ example: 'Hematología', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  section?: string | null;

  @ApiPropertyOptional({ description: 'Valor UB (ej: "2.50")', nullable: true })
  @IsOptional()
  @IsNumberString()
  @MaxLength(20)
  units?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSpecialAct?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Valores de referencia orientativos para el bioquimico', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referenceValue?: string | null;

  @ApiPropertyOptional({ description: 'Metodologia por defecto (se imprime en el PDF)', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  methodology?: string | null;

  @ApiPropertyOptional({ default: false, description: 'true = el laboratorio la elabora; false = se deriva' })
  @IsOptional()
  @IsBoolean()
  isElaborated?: boolean;
}
