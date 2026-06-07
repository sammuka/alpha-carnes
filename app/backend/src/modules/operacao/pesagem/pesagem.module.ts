import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RecebimentoModule } from '../recebimento/recebimento.module';
import { PesagemController } from './pesagem.controller';
import { PesagemService } from './pesagem.service';
import { AssociacaoService } from './associacao.service';
import { EtiquetaService } from './etiqueta.service';

// F4b — Pesagem + Associação sugestiva + Etiquetagem. Gateways de hardware vêm do
// HardwareModule (global); reusa DivergenciaRecebimentoService (F4a) para abrir
// divergência em peça sem cobertura.
@Module({
  imports: [AuthModule, RecebimentoModule],
  controllers: [PesagemController],
  providers: [PesagemService, AssociacaoService, EtiquetaService],
  exports: [PesagemService, AssociacaoService, EtiquetaService],
})
export class PesagemModule {}
