import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig], isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
        customProps: () => ({ context: 'HTTP' }),
      },
    }),
    DatabaseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
