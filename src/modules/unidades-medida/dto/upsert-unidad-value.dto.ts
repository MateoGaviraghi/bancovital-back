import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpsertUnidadValueDto {
  @ApiProperty({ description: 'Id de la unidad asociada a la práctica de esta línea' })
  @IsInt()
  @Min(1)
  unidadId!: number;

  @ApiProperty({
    required: false,
    description: 'Decimal string (ej "98.5"). Al menos uno de valueNumeric o valueText.',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim().replace(',', '.');
    return v === '' ? undefined : v;
  })
  @ValidateIf((o: UpsertUnidadValueDto) => o.valueText === undefined || o.valueText === null)
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/, { message: 'valueNumeric debe ser un decimal valido' })
  @IsOptional()
  valueNumeric?: string;

  @ApiProperty({
    required: false,
    description: 'Valor textual (ej "POSITIVO", "Amarillo claro").',
  })
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @ValidateIf((o: UpsertUnidadValueDto) => o.valueNumeric === undefined || o.valueNumeric === null)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  valueText?: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
