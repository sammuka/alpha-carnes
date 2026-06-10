import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { NfseModule } from '../../../integracoes/nfse/nfse.module';
import { ExpedicaoModule } from '../expedicao/expedicao.module';
import { FaturamentoController } from './faturamento.controller';
import { ConsolidacaoService } from './consolidacao.service';
import { FaturamentoService } from './faturamento.service';

@Module({
  imports: [AuthModule, NfseModule, ExpedicaoModule],
  controllers: [FaturamentoController],
  providers: [ConsolidacaoService, FaturamentoService],
  exports: [ConsolidacaoService, FaturamentoService],
})
export class FaturamentoModule {}
