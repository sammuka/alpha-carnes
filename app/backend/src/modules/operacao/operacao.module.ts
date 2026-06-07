import { Module } from '@nestjs/common';
import { RecebimentoModule } from './recebimento/recebimento.module';
import { PesagemModule } from './pesagem/pesagem.module';

// Agregador do domínio operacional (F4a — Recebimento; F4b — Pesagem/Associação).
@Module({
  imports: [RecebimentoModule, PesagemModule],
})
export class OperacaoModule {}
