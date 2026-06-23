import { PartialType } from '@nestjs/swagger';
import { CreateVeterinarioDto } from './create-veterinario.dto';

export class UpdateVeterinarioDto extends PartialType(CreateVeterinarioDto) {}
