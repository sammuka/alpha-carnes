import { Module } from '@nestjs/common';
import { RecebimentoModule } from './recebimento/recebimento.module';
import { PesagemModule } from './pesagem/pesagem.module';
import { CorteModule } from './corte/corte.module';
import { ExpedicaoModule } from './expedicao/expedicao.module';
import { FaturamentoModule } from './faturamento/faturamento.module';

// Agregador do domínio operacional (F4a — Recebimento; F4b — Pesagem; F4c — Corte; F5 — Expedição; F6a — Faturamento).
@Module({
  imports: [RecebimentoModule, PesagemModule, CorteModule, ExpedicaoModule, FaturamentoModule],
})
export class OperacaoModule {}
