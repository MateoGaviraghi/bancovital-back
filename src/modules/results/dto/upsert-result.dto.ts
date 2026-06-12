import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpsertResultDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  orderPracticeId!: number;

  @ApiProperty({
    required: false,
    description:
      'Valor numerico como decimal string (ej "98.5"). Mutuamente excluyente o complementario con valueText.',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim().replace(',', '.');
    return v === '' ? undefined : v;
  })
  @ValidateIf((o: UpsertResultDto) => o.valueText === undefined || o.valueText === null)
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/, { message: 'valueNumeric debe ser un decimal valido' })
  @IsOptional()
  valueNumeric?: string;

  @ApiProperty({
    required: false,
    description:
      'Resultado textual (POSITIVO/NEGATIVO/INDETERMINADO, etc.). Si esta seteado, valueNumeric es opcional.',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o: UpsertResultDto) => o.valueNumeric === undefined || o.valueNumeric === null)
  @IsString()
  @IsOptional()
  valueText?: string;

  @ApiProperty({ required: false, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  methodology?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
