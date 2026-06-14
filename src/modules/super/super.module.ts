import { Module } from '@nestjs/common';
import { LabConfigModule } from '../lab-config/lab-config.module';
import { UsersModule } from '../users/users.module';
import { SuperMetricsController } from './super-metrics.controller';
import { SuperController } from './super.controller';
import { SuperService } from './super.service';

@Module({
  imports: [UsersModule, LabConfigModule],
  controllers: [SuperController, SuperMetricsController],
  providers: [SuperService],
})
export class SuperModule {}
