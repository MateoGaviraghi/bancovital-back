import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateMovimientoDto {
  @ApiProperty({ enum: ['cargo', 'pago'], example: 'cargo' })
  @IsIn(['cargo', 'pago'])
  tipo!: 'cargo' | 'pago';

  @ApiProperty({
    example: '15000.00',
    description: 'Monto positivo (decimal con hasta 2 decimales)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'monto debe ser un decimal positivo con hasta 2 dec (ej "15000.00")',
  })
  @Matches(/^(?!0+(\.0+)?$)/, { message: 'monto debe ser mayor que 0' })
  monto!: string;

  @ApiProperty({ example: 'Excedentes mayo 2026' })
  @IsString()
  @MinLength(2)
  concepto!: string;

  @ApiPropertyOptional({ example: 'Pagado por transferencia' })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Fecha ISO del movimiento',
  })
  @IsOptional()
  @IsISO8601()
  fecha?: string;
}

export class SetMorosoDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  moroso!: boolean;
}
