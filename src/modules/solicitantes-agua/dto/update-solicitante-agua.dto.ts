import { PartialType } from '@nestjs/swagger';
import { CreateSolicitanteAguaDto } from './create-solicitante-agua.dto';

export class UpdateSolicitanteAguaDto extends PartialType(CreateSolicitanteAguaDto) {}
