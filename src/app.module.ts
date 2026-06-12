import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppConfig } from './config';
import { DatabaseModule } from './db/database.module';
import { ConsumoModule } from './modules/consumo/consumo.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { HealthModule } from './modules/health/health.module';
import { InsurersModule } from './modules/insurers/insurers.module';
import { LabConfigModule } from './modules/lab-config/lab-config.module';
import { MeModule } from './modules/me/me.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PlansModule } from './modules/plans/plans.module';
import { PracticesModule } from './modules/practices/practices.module';
import { PreferenciaPdfModule } from './modules/preferencia-pdf/preferencia-pdf.module';
import { PublicModule } from './modules/public/public.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ResultsModule } from './modules/results/results.module';
import { SuperModule } from './modules/super/super.module';
import { UnidadesMedidaModule } from './modules/unidades-medida/unidades-medida.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    MeModule,
    PatientsModule,
    DoctorsModule,
    InsurersModule,
    PracticesModule,
    LabConfigModule,
    ResultsModule,
    OrdersModule,
    ReportsModule,
    UsersModule,
    PreferenciaPdfModule,
    SuperModule,
    UnidadesMedidaModule,
    PublicModule,
    ConsumoModule,
    PlansModule,
  ],
  providers: [
    AppConfig,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AppConfig],
})
export class AppModule {}
