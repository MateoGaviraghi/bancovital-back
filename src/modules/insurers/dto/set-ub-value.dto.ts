import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class SetUbValueDto {
  @ApiProperty({ description: 'Id de la obra social' })
  @IsInt()
  @Min(1)
  insurerId!: number;

  @ApiProperty({
    description: 'Valor UB como string con hasta 2 decimales (ej "1742.50")',
    example: '1742.50',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'value debe ser un decimal con hasta 2 dec (ej "1742.50")',
  })
  value!: string;

  @ApiProperty({ format: 'date', description: 'Vigencia desde (YYYY-MM-DD)' })
  @IsDateString()
  validFrom!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
