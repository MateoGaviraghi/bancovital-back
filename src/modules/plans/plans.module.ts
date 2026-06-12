import { ConsumoModule } from '@/modules/consumo/consumo.module';
import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [ConsumoModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
