import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const TIPOS_MUESTRA = [
  'Agua para consumo',
  'Agua de pozo',
  'Agua de red',
  'Agua superficial',
  'Agua de piscina',
  'Efluente',
  'Otra',
] as const;

const MOTIVOS = [
  'Control de rutina',
  'Habilitación',
  'Reclamo',
  'Auditoría',
  'Particular',
  'Otro',
] as const;

export class CreateMuestraAguaDto {
  @ApiProperty() @IsInt() @Min(1) solicitanteId!: number;
  @ApiProperty() @IsDateString() fechaToma!: string;
  @ApiProperty() @IsDateString() fechaRecepcion!: string;
  @ApiProperty({ enum: TIPOS_MUESTRA }) @IsIn(TIPOS_MUESTRA) tipoMuestra!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) lugarToma?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500) descripcionPunto?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) direccionPunto?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) localidadPunto?: string;
  @ApiProperty({ enum: MOTIVOS }) @IsIn(MOTIVOS) motivoAnalisis!: string;
  // Condiciones
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() recipienteAdecuado?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() recipienteEsteril?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) conservacionTransporte?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() temperaturaRecepcion?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) volumenRecibido?: string;
  @ApiProperty({ default: true }) @IsOptional() @IsBoolean() muestraApta?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) observacionesRecepcion?: string;
  // Análisis
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() analisisFisicoquimico?: boolean;
  @ApiProperty({ default: false }) @IsOptional() @IsBoolean() analisisMicrobiologico?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(1000) observaciones?: string;
}
