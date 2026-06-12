import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateLabConfigDto {
  @ApiProperty({ required: false, minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  legalName?: string;

  @ApiProperty({ required: false, example: '30-12345678-9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cuit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  streetAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, minLength: 1, maxLength: 200 })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  signingProfessionalName?: string;

  @ApiProperty({ required: false, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  signingProfessionalMp?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  signingSignaturePath?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Solo lectura — ignorado en PATCH (usar POST /lab-config/logo)',
  })
  @IsOptional()
  logoPath?: unknown;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  shortName?: string;
}
