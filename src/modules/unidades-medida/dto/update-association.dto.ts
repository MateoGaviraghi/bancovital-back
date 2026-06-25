import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAssociationDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

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
