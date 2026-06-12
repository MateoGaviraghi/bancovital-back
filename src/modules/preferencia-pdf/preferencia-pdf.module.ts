import { Module } from '@nestjs/common';
import { PreferenciaPdfController } from './preferencia-pdf.controller';
import { PreferenciaPdfService } from './preferencia-pdf.service';

@Module({
  controllers: [PreferenciaPdfController],
  providers: [PreferenciaPdfService],
  exports: [PreferenciaPdfService],
})
export class PreferenciaPdfModule {}
