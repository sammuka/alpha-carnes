import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DisponibilidadeModule } from '../../comercial/disponibilidade/disponibilidade.module';
import { OperacoesModule } from '../../operacoes/operacoes.module';
import { RecebimentoController } from './recebimento.controller';
import { RecebimentoService } from './recebimento.service';
import { PedidoFornecedorController } from './pedido-fornecedor.controller';
import { PedidoFornecedorService } from './pedido-fornecedor.service';
import { DivergenciaRecebimentoController } from './divergencia/divergencia-recebimento.controller';
import { DivergenciaRecebimentoService } from './divergencia/divergencia-recebimento.service';
import { OcorrenciaFornecedorController } from './ocorrencia/ocorrencia-fornecedor.controller';
import { OcorrenciaFornecedorService } from './ocorrencia/ocorrencia-fornecedor.service';

@Module({
  imports: [AuthModule, DisponibilidadeModule, OperacoesModule],
  controllers: [
    RecebimentoController,
    PedidoFornecedorController,
    DivergenciaRecebimentoController,
    OcorrenciaFornecedorController,
  ],
  providers: [
    RecebimentoService,
    PedidoFornecedorService,
    DivergenciaRecebimentoService,
    OcorrenciaFornecedorService,
  ],
  exports: [
    RecebimentoService,
    PedidoFornecedorService,
    DivergenciaRecebimentoService,
    OcorrenciaFornecedorService,
  ],
})
export class RecebimentoModule {}
