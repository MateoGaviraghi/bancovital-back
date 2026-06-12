import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { USER_ROLES, type UserRole } from '@/auth/session';

export class InviteUserDto {
  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn([...USER_ROLES])
  role!: UserRole;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Solo para rol=bioquimico (matricula profesional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  matricula?: string;

  @ApiProperty({ required: false, description: 'URL a la que Supabase redirige tras la invitación' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  redirectTo?: string;
}
