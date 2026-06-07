import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DisponibilidadeModule } from '../../comercial/disponibilidade/disponibilidade.module';
import { RecebimentoController } from './recebimento.controller';
import { RecebimentoService } from './recebimento.service';
import { DivergenciaRecebimentoController } from './divergencia/divergencia-recebimento.controller';
import { DivergenciaRecebimentoService } from './divergencia/divergencia-recebimento.service';
import { OcorrenciaFornecedorController } from './ocorrencia/ocorrencia-fornecedor.controller';
import { OcorrenciaFornecedorService } from './ocorrencia/ocorrencia-fornecedor.service';

@Module({
  imports: [AuthModule, DisponibilidadeModule],
  controllers: [RecebimentoController, DivergenciaRecebimentoController, OcorrenciaFornecedorController],
  providers: [RecebimentoService, DivergenciaRecebimentoService, OcorrenciaFornecedorService],
  exports: [RecebimentoService, DivergenciaRecebimentoService, OcorrenciaFornecedorService],
})
export class RecebimentoModule {}
