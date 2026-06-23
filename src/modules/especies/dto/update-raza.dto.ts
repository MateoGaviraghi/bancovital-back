import { PartialType } from '@nestjs/swagger';
import { CreateRazaDto } from './create-raza.dto';

export class UpdateRazaDto extends PartialType(CreateRazaDto) {}
