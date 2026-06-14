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

// @react-pdf/renderer es ESM — mock para tests de DI compile.
jest.mock('@/pdf/render', () => ({
  renderContratoPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
  renderContratoFirmadoPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake signed')),
  renderInformePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
  renderFichaPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}));

import { AuditService } from '@/common/audit/audit.service';
import { AppConfig } from '@/config';
import { DATABASE, SUPABASE_ADMIN } from '@/db/database.module';
import { MailService } from '@/mail/mail.service';
import { AnunciosSuperController } from '@/modules/anuncios/anuncios-super.controller';
import { AnunciosController } from '@/modules/anuncios/anuncios.controller';
import { AnunciosService } from '@/modules/anuncios/anuncios.service';
import { ConsumoController } from '@/modules/consumo/consumo.controller';
import { ConsumoService } from '@/modules/consumo/consumo.service';
import { ContractsPublicController } from '@/modules/contracts/contracts-public.controller';
import { ContractsSuperController } from '@/modules/contracts/contracts-super.controller';
import { ContractsService } from '@/modules/contracts/contracts.service';
import { ImpersonationController } from '@/modules/impersonation/impersonation.controller';
import { ImpersonationService } from '@/modules/impersonation/impersonation.service';
import { LabConfigService } from '@/modules/lab-config/lab-config.service';
import { MeController } from '@/modules/me/me.controller';
import { MeService } from '@/modules/me/me.service';
import { PlansController } from '@/modules/plans/plans.controller';
import { PlansService } from '@/modules/plans/plans.service';
import { PublicLabsController } from '@/modules/public/public-labs.controller';
import { PublicLabsService } from '@/modules/public/public-labs.service';
import { GoogleCalendarService } from '@/modules/reuniones/google-calendar.service';
import { ReunionesPublicController } from '@/modules/reuniones/reuniones-public.controller';
import { ReunionesSuperController } from '@/modules/reuniones/reuniones-super.controller';
import { ReunionesService } from '@/modules/reuniones/reuniones.service';
import { SedesController } from '@/modules/sedes/sedes.controller';
import { SedesService } from '@/modules/sedes/sedes.service';
import { BillingController } from '@/modules/super/billing.controller';
import { BillingService } from '@/modules/super/billing.service';
import { SuperMetricsController } from '@/modules/super/super-metrics.controller';
import { SuperController } from '@/modules/super/super.controller';
import { SuperService } from '@/modules/super/super.service';
import { UsersService } from '@/modules/users/users.service';
import { ConfigModule } from '@nestjs/config';
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

describe('DI compile — ConsumoModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConsumoController],
      providers: [ConsumoService, { provide: DATABASE, useValue: DB_STUB }],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — PlansModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const consumoStub = {
      periodoActual: jest.fn().mockReturnValue('2026-06'),
      getConsumoResumen: jest.fn(),
      getConsumo: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        PlansService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: ConsumoService, useValue: consumoStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — MailModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [AppConfig, MailService],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — ReunionesModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const mailStub = {
      sendReunionConfirmacion: jest.fn(),
      sendReunionNotice: jest.fn(),
    };
    const appConfigStub = {
      env: {
        APP_URL: 'http://localhost:3000',
        RESEND_API_KEY: undefined,
        MAIL_FROM: undefined,
        MAIL_NOTIFY_TO: undefined,
        OTP_DEV_LOG: undefined,
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
        GOOGLE_REFRESH_TOKEN: undefined,
        GOOGLE_CALENDAR_ID: undefined,
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'bookings', ttl: 60_000, limit: 60 },
          { name: 'bookingsPost', ttl: 10 * 60_000, limit: 5 },
        ]),
      ],
      controllers: [ReunionesPublicController, ReunionesSuperController],
      providers: [
        ReunionesService,
        GoogleCalendarService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: MailService, useValue: mailStub },
        { provide: AppConfig, useValue: appConfigStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — ContractsModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const mailStub = { sendOtp: jest.fn(), sendContractSignedNotice: jest.fn() };
    const appConfigStub = {
      env: {
        APP_URL: 'http://localhost:3000',
        RESEND_API_KEY: undefined,
        MAIL_FROM: undefined,
        MAIL_NOTIFY_TO: undefined,
        OTP_DEV_LOG: undefined,
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: 60 },
          { name: 'otp', ttl: 15 * 60_000, limit: 5 },
        ]),
      ],
      controllers: [ContractsSuperController, ContractsPublicController],
      providers: [
        ContractsService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: SUPABASE_ADMIN, useValue: SUPABASE_STUB },
        { provide: MailService, useValue: mailStub },
        { provide: AppConfig, useValue: appConfigStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — AuditModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: DATABASE, useValue: DB_STUB }],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — ImpersonationModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const auditStub = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [ImpersonationController],
      providers: [
        ImpersonationService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: AuditService, useValue: auditStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — SuperModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const auditStub = { log: jest.fn() };
    const usersStub = { invite: jest.fn() };
    const labConfigStub = { uploadAsset: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [SuperController, SuperMetricsController, BillingController],
      providers: [
        SuperService,
        BillingService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: SUPABASE_ADMIN, useValue: SUPABASE_STUB },
        { provide: AuditService, useValue: auditStub },
        { provide: UsersService, useValue: usersStub },
        { provide: LabConfigService, useValue: labConfigStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — AnunciosModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const auditStub = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [AnunciosSuperController, AnunciosController],
      providers: [
        AnunciosService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: AuditService, useValue: auditStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

describe('DI compile — SedesModule', () => {
  it('compiles without "can\'t resolve dependencies" errors', async () => {
    const auditStub = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [SedesController],
      providers: [
        SedesService,
        { provide: DATABASE, useValue: DB_STUB },
        { provide: AuditService, useValue: auditStub },
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
