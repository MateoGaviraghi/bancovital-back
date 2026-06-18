import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

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

  @ApiProperty({
    required: false,
    nullable: true,
    example: '#7c3aed',
    description: 'Color primario de marca en hex (#rrggbb). El front deriva los tokens OKLCH.',
  })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primaryColor debe ser un color hex #rrggbb.' })
  primaryColor?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: '#0ea5e9',
    description: 'Color de acento de marca en hex (#rrggbb). El front deriva los tokens OKLCH.',
  })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'accentColor debe ser un color hex #rrggbb.' })
  accentColor?: string;

  @ApiProperty({ required: false, nullable: true, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string;
}
