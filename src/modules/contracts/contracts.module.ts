import { AppConfig } from '@/config';
import { MailModule } from '@/mail/mail.module';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ContractsPublicController } from './contracts-public.controller';
import { ContractsSuperController } from './contracts-super.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [
    MailModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
      {
        name: 'otp',
        ttl: 15 * 60_000, // 15 minutos
        limit: 5,
      },
    ]),
  ],
  controllers: [ContractsSuperController, ContractsPublicController],
  providers: [ContractsService, AppConfig],
})
export class ContractsModule {}
