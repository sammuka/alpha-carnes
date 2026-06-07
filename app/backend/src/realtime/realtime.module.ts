import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeHub } from './realtime.hub';

// @Global: o hub e o gateway são infra transversal de tempo real — qualquer
// domínio emite eventos (via EventEmitter) e o gateway faz broadcast.
@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeHub, RealtimeGateway],
  exports: [RealtimeHub],
})
export class RealtimeModule {}
