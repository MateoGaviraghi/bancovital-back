import { Module } from '@nestjs/common';
import { EspeciesController } from './especies.controller';
import { EspeciesService } from './especies.service';

@Module({
  controllers: [EspeciesController],
  providers: [EspeciesService],
  exports: [EspeciesService],
})
export class EspeciesModule {}
