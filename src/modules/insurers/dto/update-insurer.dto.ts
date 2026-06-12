import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { CreateInsurerDto } from './create-insurer.dto';

export class UpdateInsurerDto extends PartialType(CreateInsurerDto) {}

export class SetActiveDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}
