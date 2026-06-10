import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { HardwareModule } from './hardware/hardware.module';
import { NfseModule } from './integracoes/nfse/nfse.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthController } from './health/health.controller';
import { appConfig } from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { PerfisModule } from './modules/perfis/perfis.module';
import { ClientesModule } from './modules/cadastros/clientes/clientes.module';
import { FornecedoresModule } from './modules/cadastros/fornecedores/fornecedores.module';
import { ItensCompraModule } from './modules/cadastros/itens-compra/itens-compra.module';
import { ItensComerciaisModule } from './modules/cadastros/itens-comerciais/itens-comerciais.module';
import { RegrasDesdobramentoModule } from './modules/cadastros/regras-desdobramento/regras-desdobramento.module';
import { ProntidaoModule } from './modules/cadastros/prontidao/prontidao.module';
import { ParametrosModule } from './modules/parametros/parametros.module';
import { ComercialModule } from './modules/comercial/comercial.module';
import { OperacaoModule } from './modules/operacao/operacao.module';
import { AuditoriaModule } from './common/auditoria/auditoria.module';
import { AuditoriaInterceptor } from './common/interceptors/auditoria.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig], isGlobal: true }),
    EventEmitterModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? crypto.randomUUID(),
        customProps: () => ({ context: 'HTTP' }),
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_LOGIN_TTL') ?? 60000,
          limit: config.get<number>('THROTTLE_LOGIN_LIMIT') ?? 5,
        },
      ],
    }),
    DatabaseModule,
    HardwareModule,
    NfseModule,
    AuditoriaModule,
    RealtimeModule,
    AuthModule,
    UsuariosModule,
    PerfisModule,
    ClientesModule,
    FornecedoresModule,
    ItensCompraModule,
    ItensComerciaisModule,
    RegrasDesdobramentoModule,
    ProntidaoModule,
    ParametrosModule,
    ComercialModule,
    OperacaoModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditoriaInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
