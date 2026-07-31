import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AprovacoesModule } from '../../gestao/aprovacoes/aprovacoes.module';
import { RecebimentoModule } from '../recebimento/recebimento.module';
import { PesagemController } from './pesagem.controller';
import { PesagemService } from './pesagem.service';
import { AssociacaoService } from './associacao.service';
import { EtiquetaService } from './etiqueta.service';
import { TrocaPecaService } from './troca-peca.service';

// F4b — Pesagem + Associação sugestiva + Etiquetagem. Gateways de hardware vêm do
// HardwareModule (global); reusa DivergenciaRecebimentoService (F4a) para abrir
// divergência em peça sem cobertura.
@Module({
  imports: [AuthModule, RecebimentoModule, AprovacoesModule],
  controllers: [PesagemController],
  providers: [PesagemService, AssociacaoService, EtiquetaService, TrocaPecaService],
  exports: [PesagemService, AssociacaoService, EtiquetaService, TrocaPecaService],
})
export class PesagemModule {}
