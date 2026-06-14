import { AppConfig } from '@/config';
import { OrdersModule } from '@/modules/orders/orders.module';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicReportsController } from './public-reports.controller';
import { PublicReportsService } from './public-reports.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    OrdersModule,
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
      // Portal del paciente (F7): metadata generosa, descarga muy acotada.
      { name: 'publicInforme', ttl: 60_000, limit: 30 },
      { name: 'publicInformeDownload', ttl: 10 * 60_000, limit: 5 },
    ]),
  ],
  controllers: [ReportsController, PublicReportsController],
  providers: [ReportsService, PublicReportsService, AppConfig],
  exports: [ReportsService],
})
export class ReportsModule {}
