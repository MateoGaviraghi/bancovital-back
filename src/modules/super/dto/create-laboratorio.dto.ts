import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateLaboratorioDto {
  @IsString()
  @MaxLength(63)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/, {
    message: 'slug debe tener formato válido (minúsculas, números, guiones; no puede empezar ni terminar con guion)',
  })
  slug!: string;

  @IsString()
  @MaxLength(255)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string | null;

  @IsOptional()
  @IsString()
  cuit?: string | null;

  @IsOptional()
  @IsString()
  streetAddress?: string | null;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  signingProfessionalName?: string | null;

  @IsOptional()
  @IsString()
  signingProfessionalMp?: string | null;
}

export class UpdateLaboratorioDto {
  @IsOptional()
  @IsString()
  @MaxLength(63)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/, {
    message: 'slug debe tener formato válido (minúsculas, números, guiones; no puede empezar ni terminar con guion)',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string | null;

  @IsOptional()
  @IsString()
  cuit?: string | null;

  @IsOptional()
  @IsString()
  streetAddress?: string | null;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  signingProfessionalName?: string | null;

  @IsOptional()
  @IsString()
  signingProfessionalMp?: string | null;

  @IsOptional()
  @IsIn(['activo', 'suspendido', 'inactivo'])
  estado?: 'activo' | 'suspendido' | 'inactivo';

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primaryColor debe ser un hex de 6 dígitos (ej: #3a7bd5)' })
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'tagline no puede superar 120 caracteres' })
  tagline?: string | null;
}
