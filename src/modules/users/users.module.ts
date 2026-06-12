import { AppConfig } from '@/config';
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AppConfig],
  exports: [UsersService],
})
export class UsersModule {}
