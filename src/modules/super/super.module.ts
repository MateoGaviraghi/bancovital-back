import { Module } from '@nestjs/common';
import { LabConfigModule } from '../lab-config/lab-config.module';
import { UsersModule } from '../users/users.module';
import { SuperController } from './super.controller';
import { SuperService } from './super.service';

@Module({
  imports: [UsersModule, LabConfigModule],
  controllers: [SuperController],
  providers: [SuperService],
})
export class SuperModule {}
