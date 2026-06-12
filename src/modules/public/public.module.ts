import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicLabsController } from './public-labs.controller';
import { PublicLabsService } from './public-labs.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'public',
        ttl: 60_000, // 1 minuto en ms
        limit: 30,
      },
    ]),
  ],
  controllers: [PublicLabsController],
  providers: [PublicLabsService],
})
export class PublicModule {}
