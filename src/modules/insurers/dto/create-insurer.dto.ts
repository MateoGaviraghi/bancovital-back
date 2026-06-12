import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateInsurerDto {
  @ApiProperty({
    description: 'Codigo unico mayuscula y digitos (ej "IAPOS", "OSDE")',
    minLength: 2,
    maxLength: 32,
    example: 'IAPOS',
  })
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code debe ser MAYUSCULAS, digitos, guiones bajos o medios',
  })
  code!: string;

  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  requiresAuthorization?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
