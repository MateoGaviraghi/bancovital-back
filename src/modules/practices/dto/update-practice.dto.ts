import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdatePracticeDto {
  @ApiPropertyOptional({ example: '10201' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nbuCode?: string;

  @ApiPropertyOptional({ example: 'Hemograma completo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({
    description: 'Valores de referencia orientativos para el bioquimico',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referenceValue?: string | null;

  @ApiPropertyOptional({
    description: 'Metodologia por defecto (se imprime en el PDF)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  methodology?: string | null;

  @ApiPropertyOptional({
    description: 'Unidad de medida por defecto (ej: mg/dL, %, U/L). Se presetea en la carga de resultados.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  defaultUnit?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null para quitar el padre' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @ApiPropertyOptional({ description: 'true = el laboratorio la elabora; false = se deriva' })
  @IsOptional()
  @IsBoolean()
  isElaborated?: boolean;
}
