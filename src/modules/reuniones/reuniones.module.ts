import { AppConfig } from '@/config';
import { MailModule } from '@/mail/mail.module';
import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { GoogleCalendarService } from './google-calendar.service';
import { ReunionesPublicController } from './reuniones-public.controller';
import { ReunionesSuperController } from './reuniones-super.controller';
import { ReunionesService } from './reuniones.service';

@Module({
  imports: [
    MailModule,
    ThrottlerModule.forRoot([
      { name: 'bookings', ttl: 60_000, limit: 60 },
      { name: 'bookingsPost', ttl: 10 * 60_000, limit: 5 },
      { name: 'bookingsToken', ttl: 60_000, limit: 30 },
    ]),
  ],
  controllers: [ReunionesPublicController, ReunionesSuperController],
  providers: [ReunionesService, GoogleCalendarService, AppConfig],
})
export class ReunionesModule {}
