import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { USER_ROLES, type UserRole } from '@/auth/session';

export class SetRoleDto {
  @ApiProperty({ enum: USER_ROLES })
  @IsIn([...USER_ROLES])
  role!: UserRole;
}
