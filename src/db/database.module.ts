import { Global, Module } from '@nestjs/common';
import { getAdminClient } from './admin';
import { type Db, getDb } from './client';

export const DATABASE = Symbol('DATABASE');
export const SUPABASE_ADMIN = Symbol('SUPABASE_ADMIN');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (): Db => getDb(),
    },
    {
      provide: SUPABASE_ADMIN,
      useFactory: () => getAdminClient(),
    },
  ],
  exports: [DATABASE, SUPABASE_ADMIN],
})
export class DatabaseModule {}
