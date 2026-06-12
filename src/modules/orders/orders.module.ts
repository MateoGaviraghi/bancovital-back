import { ConsumoModule } from '@/modules/consumo/consumo.module';
import { ResultsModule } from '@/modules/results/results.module';
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ResultsModule, ConsumoModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
