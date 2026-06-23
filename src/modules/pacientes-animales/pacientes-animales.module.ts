import { Module } from '@nestjs/common';
import { PacientesAnimalesController } from './pacientes-animales.controller';
import { PacientesAnimalesService } from './pacientes-animales.service';

@Module({
  controllers: [PacientesAnimalesController],
  providers: [PacientesAnimalesService],
  exports: [PacientesAnimalesService],
})
export class PacientesAnimalesModule {}
