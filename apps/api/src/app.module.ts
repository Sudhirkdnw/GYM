import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { LoggingModule } from './logging/logging.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { TenantModule } from './common/tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PermissionsGuard } from './common/auth/permissions.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    LoggingModule,
    DatabaseModule,
    TenantModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
