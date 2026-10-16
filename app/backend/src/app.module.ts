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
import { FrotaModule } from './modules/frota/frota.module';
import { ModelosEtiquetaModule } from './modules/modelos-etiqueta/modelos-etiqueta.module';
import { RegrasDesdobramentoModule } from './modules/cadastros/regras-desdobramento/regras-desdobramento.module';
import { ProdutosModule } from './modules/cadastros/produtos/produtos.module';
import { RepresentantesModule } from './modules/cadastros/representantes/representantes.module';
import { RotasModule } from './modules/cadastros/rotas/rotas.module';
import { ProntidaoModule } from './modules/cadastros/prontidao/prontidao.module';
import { ParametrosModule } from './modules/parametros/parametros.module';
import { ComercialModule } from './modules/comercial/comercial.module';
import { EspelhoModule } from './modules/comercial/espelho/espelho.module';
import { OperacaoModule } from './modules/operacao/operacao.module';
import { OperacoesModule } from './modules/operacoes/operacoes.module';
import { DashboardModule } from './modules/gestao/dashboard/dashboard.module';
import { AprovacoesModule } from './modules/gestao/aprovacoes/aprovacoes.module';
import { SifModule } from './modules/gestao/sif/sif.module';
import { AuditoriaConsultaModule } from './modules/auditoria/auditoria.module';
import { EmpresasFiscaisModule } from './modules/erp/fiscal/empresas/empresas-fiscais.module';
import { EnquadramentosFiscaisModule } from './modules/erp/fiscal/enquadramentos/enquadramentos-fiscais.module';
import { RegrasTributariasModule } from './modules/erp/fiscal/regras/regras-tributarias.module';
import { SimulacoesFiscaisModule } from './modules/erp/fiscal/simulacoes/simulacoes-fiscais.module';
import { HomologacoesRegrasModule } from './modules/erp/fiscal/homologacoes/homologacoes-regras.module';
import { PlanoContasModule } from './modules/contabilidade/plano/plano.module';
import { AuditoriaModule } from './common/auditoria/auditoria.module';
import { AuditoriaInterceptor } from './common/interceptors/auditoria.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { IncomingMessage } from 'http';
import type { Writable } from 'stream';
import { logRedact, logTestSink } from './common/logging/redact';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfig], isGlobal: true }),
    EventEmitterModule.forRoot(),
    LoggerModule.forRootAsync({
      useFactory: () => {
        const opts = {
          level: process.env.LOG_LEVEL ?? 'info',
          redact: logRedact,
          genReqId: (req: IncomingMessage) =>
            (req.headers['x-request-id'] as string | undefined) ?? crypto.randomUUID(),
          customProps: () => ({ context: 'HTTP' }),
        };
        if (logTestSink.stream) {
          return { pinoHttp: [opts, logTestSink.stream] as [typeof opts, Writable] };
        }
        return {
          pinoHttp: {
            ...opts,
            transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
          },
        };
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
    FrotaModule,
    ModelosEtiquetaModule,
    ProdutosModule,
    RepresentantesModule,
    RotasModule,
    RegrasDesdobramentoModule,
    ProntidaoModule,
    ParametrosModule,
    OperacoesModule,
    ComercialModule,
    EspelhoModule,
    OperacaoModule,
    DashboardModule,
    AprovacoesModule,
    SifModule,
    AuditoriaConsultaModule,
    EmpresasFiscaisModule,
    EnquadramentosFiscaisModule,
    RegrasTributariasModule,
    SimulacoesFiscaisModule,
    HomologacoesRegrasModule,
    PlanoContasModule,
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
