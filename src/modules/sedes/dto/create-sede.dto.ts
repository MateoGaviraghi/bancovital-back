import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSedeDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  nombre!: string;

  @ApiProperty({ minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  direccion!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  localidad?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  horarios?: string;

  @ApiProperty({ required: false, nullable: true, default: false })
  @IsOptional()
  @IsBoolean()
  principal?: boolean;

  @ApiProperty({ required: false, nullable: true, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
