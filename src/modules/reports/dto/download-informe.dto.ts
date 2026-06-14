import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class DownloadInformeDto {
  @ApiProperty({
    description: 'DNI del paciente (solo dígitos; se normaliza).',
    example: '30123456',
  })
  @IsString()
  @Length(6, 15)
  dni!: string;
}
