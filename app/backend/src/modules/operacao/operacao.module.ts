import { Module } from '@nestjs/common';
import { RecebimentoModule } from './recebimento/recebimento.module';

// Agregador do domínio operacional (F4a — Recebimento + Divergências).
@Module({
  imports: [RecebimentoModule],
})
export class OperacaoModule {}
