import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { NfseModule } from '../../../integracoes/nfse/nfse.module';
import { OperacoesModule } from '../../operacoes/operacoes.module';
import { ExpedicaoModule } from '../expedicao/expedicao.module';
import { FaturamentoController } from './faturamento.controller';
import { ConsolidacaoService } from './consolidacao.service';
import { FaturamentoService } from './faturamento.service';
import { NotasConsultaService } from './notas-consulta.service';

@Module({
  imports: [AuthModule, NfseModule, ExpedicaoModule, OperacoesModule],
  controllers: [FaturamentoController],
  providers: [ConsolidacaoService, FaturamentoService, NotasConsultaService],
  exports: [ConsolidacaoService, FaturamentoService, NotasConsultaService],
})
export class FaturamentoModule {}
