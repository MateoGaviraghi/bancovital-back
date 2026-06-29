import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertUnidadRefEspecieDto {
  @ApiProperty()
  @IsInt()
  especieId!: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumberString()
  rangeLow?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumberString()
  rangeHigh?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceText?: string | null;
}
