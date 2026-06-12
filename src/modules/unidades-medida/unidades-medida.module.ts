import { Module } from '@nestjs/common';
import { OrderPracticeUnidadesController } from './order-practice-unidades.controller';
import { PracticeUnidadesController } from './practice-unidades.controller';
import { UnidadesMedidaController } from './unidades-medida.controller';
import { UnidadesMedidaService } from './unidades-medida.service';

@Module({
  controllers: [
    UnidadesMedidaController,
    PracticeUnidadesController,
    OrderPracticeUnidadesController,
  ],
  providers: [UnidadesMedidaService],
  exports: [UnidadesMedidaService],
})
export class UnidadesMedidaModule {}
