import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { PlansModule } from './plans/plans.module';
import { PaymentsModule } from './payments/payments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { OffersModule } from './offers/offers.module';
import { AttendanceModule } from './attendance/attendance.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { DietModule } from './diet/diet.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { StaffModule } from './staff/staff.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GymModule } from './gym/gym.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QueuesModule } from './queues/queues.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL || 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT || 100),
      },
    ]),
    PrismaModule,
    AuditModule,
    StorageModule,
    QueuesModule,
    AuthModule,
    MembersModule,
    PlansModule,
    PaymentsModule,
    InvoicesModule,
    OffersModule,
    AttendanceModule,
    WhatsAppModule,
    DietModule,
    WorkoutsModule,
    StaffModule,
    DashboardModule,
    GymModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
