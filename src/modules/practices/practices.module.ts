import { Module } from '@nestjs/common';
import { LabPracticeConfigController } from './lab-practice-config.controller';
import { LabPracticeConfigService } from './lab-practice-config.service';
import { PracticesController } from './practices.controller';
import { PracticesService } from './practices.service';

@Module({
  controllers: [PracticesController, LabPracticeConfigController],
  providers: [PracticesService, LabPracticeConfigService],
  exports: [PracticesService, LabPracticeConfigService],
})
export class PracticesModule {}
