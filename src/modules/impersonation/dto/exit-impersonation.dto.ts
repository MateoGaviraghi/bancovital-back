import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ExitImpersonationDto {
  @ApiProperty({ description: 'Lab que se estaba impersonando (para auditoría)' })
  @IsInt()
  @Min(1)
  labId!: number;
}
