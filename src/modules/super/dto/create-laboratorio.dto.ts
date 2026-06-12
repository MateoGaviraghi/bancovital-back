import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateLaboratorioDto {
  @IsString()
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug solo puede contener minúsculas, números y guiones' })
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
  @Matches(/^[a-z0-9-]+$/, { message: 'slug solo puede contener minúsculas, números y guiones' })
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
}
