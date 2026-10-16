import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { SimulacoesController } from './simulacoes.controller';
import { SimulacoesFiscaisService } from './simulacoes.service';

@Module({
  imports: [AuthModule],
  controllers: [SimulacoesController],
  providers: [SimulacoesFiscaisService],
  exports: [SimulacoesFiscaisService],
})
export class SimulacoesFiscaisModule {}
