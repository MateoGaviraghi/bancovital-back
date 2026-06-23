import { PartialType } from '@nestjs/swagger';
import { CreatePacienteAnimalDto } from './create-paciente-animal.dto';

export class UpdatePacienteAnimalDto extends PartialType(CreatePacienteAnimalDto) {}
