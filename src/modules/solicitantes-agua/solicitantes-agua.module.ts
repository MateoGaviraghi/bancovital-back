import { Module } from '@nestjs/common';
import { SolicitantesAguaController } from './solicitantes-agua.controller';
import { SolicitantesAguaService } from './solicitantes-agua.service';

@Module({
  controllers: [SolicitantesAguaController],
  providers: [SolicitantesAguaService],
  exports: [SolicitantesAguaService],
})
export class SolicitantesAguaModule {}
