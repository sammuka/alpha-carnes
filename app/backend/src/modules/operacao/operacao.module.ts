import { Module } from '@nestjs/common';
import { RecebimentoModule } from './recebimento/recebimento.module';
import { PesagemModule } from './pesagem/pesagem.module';
import { CorteModule } from './corte/corte.module';

// Agregador do domínio operacional (F4a — Recebimento; F4b — Pesagem; F4c — Corte).
@Module({
  imports: [RecebimentoModule, PesagemModule, CorteModule],
})
export class OperacaoModule {}
