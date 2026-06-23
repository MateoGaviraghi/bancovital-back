import { PartialType } from '@nestjs/swagger';
import { CreateEspecieDto } from './create-especie.dto';

export class UpdateEspecieDto extends PartialType(CreateEspecieDto) {}
