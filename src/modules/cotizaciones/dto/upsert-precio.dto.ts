import { IsInt, IsNumberString, IsOptional } from 'class-validator';

export class UpsertPrecioDto {
  @IsInt()
  practiceId!: number;

  @IsOptional()
  @IsInt()
  insurerId?: number;

  @IsNumberString()
  precio!: string;
}
