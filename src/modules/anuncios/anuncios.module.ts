import { Module } from '@nestjs/common';
import { AnunciosSuperController } from './anuncios-super.controller';
import { AnunciosController } from './anuncios.controller';
import { AnunciosService } from './anuncios.service';

@Module({
  controllers: [AnunciosSuperController, AnunciosController],
  providers: [AnunciosService],
})
export class AnunciosModule {}
