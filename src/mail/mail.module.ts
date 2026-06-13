import { AppConfig } from '@/config';
import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [AppConfig, MailService],
  exports: [MailService],
})
export class MailModule {}
