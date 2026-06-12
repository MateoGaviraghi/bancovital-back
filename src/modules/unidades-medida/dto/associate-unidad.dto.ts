import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AssociateUnidadDto {
  @ApiProperty({ description: 'Id de la unidad de medida a asociar a la práctica' })
  @IsInt()
  @Min(1)
  unidadId!: number;

  @ApiPropertyOptional({
    description: 'Orden de aparición en el form y en el PDF. Default 0.',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
