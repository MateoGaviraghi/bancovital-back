/**
 * DI compile regression spec.
 *
 * Validates that every @Controller / @Injectable in MeModule and PublicModule
 * can be resolved by the NestJS DI container. If any service is imported with
 * `import type` (which TypeScript erases at compile time), emitDecoratorMetadata
 * emits `Function` as the metadata token and Nest throws
 * "Nest can't resolve dependencies of the XController (?)" at this point,
 * failing the test before any HTTP call is made.
 *
 * External tokens (DATABASE, SUPABASE_ADMIN) are stubbed with useValue so we
 * don't need a real DB or Supabase connection.
 */

// Set required env vars before any module import so config validation passes.
process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.SUPABASE_URL = 'https://dummy.supabase.co';
process.env.SUPABASE_ANON_KEY = 'dummy-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-key';

import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { MeController } from '@/modules/me/me.controller';
import { MeService } from '@/modules/me/me.service';
import { PublicLabsController } from '@/modules/public/public-labs.controller';
import { PublicLabsService } from '@/modules/public/public-labs.service';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';

const DB_STUB = {} as never;
const SUPABASE_STUB = {} as never;

describe('DI compile — MeModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        MeService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: SUPABASE_ADMIN, useValue: SUPABASE_STUB },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — PublicModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'public', ttl: 60_000, limit: 30 }])],
      controllers: [PublicLabsController],
      providers: [
        PublicLabsService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: SUPABASE_ADMIN, useValue: SUPABASE_STUB },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
