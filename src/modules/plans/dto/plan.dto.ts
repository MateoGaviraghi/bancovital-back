import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'Básico', description: 'Nombre único del plan' })
  @IsString()
  nombre!: string;

  @ApiProperty({ example: 100, description: 'Cupo de órdenes por mes (> 0)' })
  @IsInt()
  @Min(1)
  cupoOrdenesMes!: number;

  @ApiProperty({
    example: '15000.00',
    description: 'Precio mensual del plan (decimal con hasta 2 decimales)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'precioMensual debe ser un decimal con hasta 2 dec (ej "15000.00")',
  })
  precioMensual!: string;

  @ApiProperty({
    example: '200.00',
    description: 'Precio por orden excedente (decimal con hasta 2 decimales)',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'precioOrdenExcedente debe ser un decimal con hasta 2 dec (ej "200.00")',
  })
  precioOrdenExcedente!: string;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  cupoOrdenesMes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'precioMensual debe ser un decimal con hasta 2 dec',
  })
  precioMensual?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'precioOrdenExcedente debe ser un decimal con hasta 2 dec',
  })
  precioOrdenExcedente?: string;
}

export class SetSubscriptionDto {
  @ApiProperty({ example: 1, description: 'ID del plan a asignar al laboratorio' })
  @IsInt()
  @Min(1)
  planId!: number;
}
