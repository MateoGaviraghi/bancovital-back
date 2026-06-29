import { Module } from '@nestjs/common';
import { MuestrasAguaController } from './muestras-agua.controller';
import { MuestrasAguaService } from './muestras-agua.service';

@Module({
  controllers: [MuestrasAguaController],
  providers: [MuestrasAguaService],
  exports: [MuestrasAguaService],
})
export class MuestrasAguaModule {}
