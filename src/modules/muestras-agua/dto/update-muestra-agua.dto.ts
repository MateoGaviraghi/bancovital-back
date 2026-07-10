import { PartialType } from '@nestjs/swagger';
import { CreateMuestraAguaDto } from './create-muestra-agua.dto';

export class UpdateMuestraAguaDto extends PartialType(CreateMuestraAguaDto) {}
