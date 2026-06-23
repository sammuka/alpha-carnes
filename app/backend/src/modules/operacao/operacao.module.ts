import { Module } from '@nestjs/common';
import { RecebimentoModule } from './recebimento/recebimento.module';
import { PesagemModule } from './pesagem/pesagem.module';
import { CorteModule } from './corte/corte.module';
import { DesossaModule } from './desossa/desossa.module';
import { EstoqueModule } from './estoque/estoque.module';
import { ExpedicaoModule } from './expedicao/expedicao.module';
import { FaturamentoModule } from './faturamento/faturamento.module';

// Agregador do domínio operacional (F4a — Recebimento; F4b — Pesagem; F4c — Corte; F4d — Desossa; F4e — Estoque; F5 — Expedição; F6a — Faturamento).
@Module({
  imports: [RecebimentoModule, PesagemModule, CorteModule, DesossaModule, EstoqueModule, ExpedicaoModule, FaturamentoModule],
})
export class OperacaoModule {}
