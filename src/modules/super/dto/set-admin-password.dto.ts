import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetAdminPasswordDto {
  @ApiProperty({ description: 'Nueva contraseña del admin del laboratorio', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
