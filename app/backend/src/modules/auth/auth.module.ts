import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { AuthRepository } from './auth.repository';
import { RbacService } from './rbac.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_ACCESS_TTL') ?? '15m') as StringValue },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthRepository, RbacService, JwtStrategy],
  exports: [RbacService, AuthRepository, JwtModule, TokenService],
})
export class AuthModule {}
