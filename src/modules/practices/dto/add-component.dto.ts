import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AddComponentDto {
  @ApiProperty({ description: 'ID de la práctica que será componente de esta práctica' })
  @IsInt()
  @Min(1)
  componentId!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
