import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PasswordHasherService } from './password-hasher.service';
import { AuthController } from './auth.controller';
import { RbacTestController } from './rbac-test.controller';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { TenantModule } from '../common/tenant/tenant.module';
import { AUTH_CONFIG } from '@gymos/config';

@Module({
  imports: [
    TenantModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get<string>('jwt.secret') ||
          'development-jwt-secret-min-16-chars-long',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.accessTokenExpiresIn') ||
            AUTH_CONFIG.ACCESS_TOKEN_EXPIRY) as `${number}m`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    PasswordHasherService,
    TokenService,
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  controllers: [AuthController, RbacTestController],
  exports: [
    AuthService,
    TokenService,
    PasswordHasherService,
    JwtAuthGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AuthModule {}
