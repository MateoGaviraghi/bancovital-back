import { AppConfig } from '@/config';
import { Module } from '@nestjs/common';
import { LabConfigModule } from '../lab-config/lab-config.module';
import { UsersModule } from '../users/users.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { SuperMetricsController } from './super-metrics.controller';
import { SuperController } from './super.controller';
import { SuperService } from './super.service';

@Module({
  imports: [UsersModule, LabConfigModule],
  controllers: [SuperController, SuperMetricsController, BillingController],
  providers: [SuperService, BillingService, AppConfig],
})
export class SuperModule {}
