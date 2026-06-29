import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSolicitanteAguaDto {
  @ApiProperty() @IsString() @MaxLength(200) nombreApellido!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(200) razonSocial?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20) cuit?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(300) domicilio?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) localidad?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(100) provincia?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
}
