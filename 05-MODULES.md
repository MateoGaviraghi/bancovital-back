# 05 — Módulos NestJS por dominio

## Estructura general

NestJS organiza por **módulos**. Cada dominio tiene su propio módulo con:

```
src/modules/<dominio>/
├── <dominio>.module.ts       # @Module declarando controllers + providers
├── <dominio>.controller.ts   # @Controller con endpoints HTTP
├── <dominio>.service.ts      # @Injectable con lógica + queries
└── dto/
    ├── create-<x>.dto.ts     # Input para POST
    ├── update-<x>.dto.ts     # Input para PATCH
    └── <x>.dto.ts            # Output / response shape
```

## Módulos a crear

| Módulo | Path | Controller base |
|---|---|---|
| HealthModule | `src/modules/health/` | `/healthz` |
| PatientsModule | `src/modules/patients/` | `/api/patients` |
| DoctorsModule | `src/modules/doctors/` | `/api/doctors` |
| InsurersModule | `src/modules/insurers/` | `/api/insurers` |
| UbValuesModule | `src/modules/ub-values/` | `/api/ub-values` (parte de Insurers) |
| PracticesModule | `src/modules/practices/` | `/api/practices` |
| OrdersModule | `src/modules/orders/` | `/api/orders` |
| ResultsModule | `src/modules/results/` | `/api/results` (y `/api/orders/:id/results`) |
| ReportsModule | `src/modules/reports/` | `/api/reports` |
| LabConfigModule | `src/modules/lab-config/` | `/api/lab-config` |
| UsersModule | `src/modules/users/` | `/api/users` |

Todos se importan en `AppModule`.

## Ejemplo completo: PatientsModule

### `dto/create-patient.dto.ts`

```typescript
import { IsString, IsOptional, IsEmail, IsIn, IsDateString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty()
  @IsString()
  @Length(7, 9)
  dni!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  lastName!: string;

  @ApiProperty({ required: false, enum: ['F', 'M', 'X'] })
  @IsOptional()
  @IsIn(['F', 'M', 'X'])
  sex?: 'F' | 'M' | 'X';

  @ApiProperty()
  @IsDateString()
  birthDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  streetAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

### `dto/update-patient.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}
```

### `patients.service.ts`

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { db } from '@/db/client';
import { patient } from '@/db/schema/patient';
import { eq, ilike, isNull, sql, and } from 'drizzle-orm';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  async search(query: string, limit = 50) {
    if (!query) {
      return db.select().from(patient)
        .where(isNull(patient.deletedAt))
        .limit(limit);
    }
    return db.select().from(patient).where(
      and(
        isNull(patient.deletedAt),
        sql`${patient.dni} ILIKE ${`%${query}%`} OR ${patient.lastName} ILIKE ${`%${query}%`} OR ${patient.firstName} ILIKE ${`%${query}%`}`,
      ),
    ).limit(limit);
  }

  async byId(id: number) {
    const [row] = await db.select().from(patient).where(eq(patient.id, id)).limit(1);
    if (!row) throw new NotFoundException('Paciente no encontrado');
    return row;
  }

  async create(dto: CreatePatientDto, userId: string) {
    const [existing] = await db.select().from(patient)
      .where(and(eq(patient.dni, dto.dni), isNull(patient.deletedAt)))
      .limit(1);
    if (existing) throw new ConflictException('DNI ya registrado');

    const [row] = await db.insert(patient).values({
      ...dto,
      createdBy: userId,
    }).returning();
    return row;
  }

  async update(id: number, dto: UpdatePatientDto) {
    await this.byId(id);  // throws if not found
    const [row] = await db.update(patient)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(patient.id, id))
      .returning();
    return row;
  }
}
```

### `patients.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { Session } from '@/auth/session';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(AuthGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  search(@Query('q') q?: string, @Query('limit') limit?: number) {
    return this.patients.search(q ?? '', limit ?? 50);
  }

  @Get(':id')
  byId(@Param('id', ParseIntPipe) id: number) {
    return this.patients.byId(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'recepcion')
  create(@Body() dto: CreatePatientDto, @CurrentUser() user: Session) {
    return this.patients.create(dto, user.userId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'recepcion')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePatientDto) {
    return this.patients.update(id, dto);
  }
}
```

### `patients.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
```

## Resto de módulos (resumen de servicios)

### DoctorsService
- `search(query, limit)`, `list()`, `byId(id)`, `create(dto)`, `update(id, dto)`, `delete(id)` (soft)

### InsurersService
- `list(onlyActive)`, `listWithCurrentUb()` (join ub_value WHERE validTo IS NULL)
- `byId(id)`, `byCode(code)`
- `create(dto)`, `update(id, dto)`, `setActive(id, active)`
- `ubHistory(insurerId)`, `setUbValue(dto)` — **transaction**: cierra row abierto + abre nuevo

### PracticesService
- `search(query, limit, section)`, `list(limit)`, `byIds(ids)`, `byNbuCode(code)`

### OrdersService
- `list(filters)` — paginado con filtros (status, insurer, date range, search)
- `byId(id)` — JOIN paciente + insurer
- `lines(orderId)` — snapshots
- `create(dto, userId)` — **transaction**: resuelve UBs, calcula pricing, snapshots, insert order + lines
- `confirm(id)` — valida transición FSM
- `cancel(id, reason)` — FSM
- `finalize(id)` — marca `resultados_cargados`
- `markEmitted(id, pdfPath, signedBy)` — usado por ReportsService

### ResultsService
- `byOrder(orderId)` — hidrata con metadata de práctica + rangos
- `upsert(dto, userId)` — calcula flag + reference range desde practice template + patient (sex, age)

### ReportsService
- `emit(orderId, signer)` — valida, render PDF, sube Storage, marca emitida
- `signedUrl(orderId, ttl)` — devuelve URL firmada. Self-healing: si falta blob, regenera
- `regenerateAll(signer)` — itera todas las emitidas y rehace los PDFs

### LabConfigService
- `get()` — lee singleton
- `update(dto)` — upsert

### UsersService
- `list()` — usa Supabase admin client + mergea con `public.user`
- `invite(dto)` — `supabase.auth.admin.inviteUserByEmail()` + `updateUserById` con role en app_metadata + mirror en public.user
- `setRole(userId, role)` — actualiza auth.users.app_metadata + public.user.role
- `setActive(userId, active)` — usa `ban_duration` en Supabase admin

## App module final

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { PatientsModule } from './modules/patients/patients.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { InsurersModule } from './modules/insurers/insurers.module';
import { PracticesModule } from './modules/practices/practices.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ResultsModule } from './modules/results/results.module';
import { ReportsModule } from './modules/reports/reports.module';
import { LabConfigModule } from './modules/lab-config/lab-config.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    HealthModule,
    PatientsModule,
    DoctorsModule,
    InsurersModule,
    PracticesModule,
    OrdersModule,
    ResultsModule,
    ReportsModule,
    LabConfigModule,
    UsersModule,
  ],
})
export class AppModule {}
```
