import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AprovacoesModule } from '../../gestao/aprovacoes/aprovacoes.module';
import { PesagemModule } from '../pesagem/pesagem.module';
import { RecebimentoModule } from '../recebimento/recebimento.module';
import { CorteController } from './corte.controller';
import { CorteService } from './corte.service';
import { SubitemService } from './subitem.service';
import { RegraCorteService } from './regra-corte.service';
import { ChecklistCorteService } from './checklist-corte.service';
import { PecasElegiveisService } from './pecas-elegiveis.service';

// F4c — Corte/Transformação. Reusa EtiquetaService (de PesagemModule) e
// DivergenciaRecebimentoService (de RecebimentoModule). Gateways de hardware
// vêm do HardwareModule (global). Onda 7: bind de regra, checklist e divergência.
@Module({
  imports: [AuthModule, PesagemModule, RecebimentoModule, AprovacoesModule],
  controllers: [CorteController],
  providers: [
    CorteService,
    SubitemService,
    RegraCorteService,
    ChecklistCorteService,
    PecasElegiveisService,
  ],
  exports: [CorteService, SubitemService, RegraCorteService, ChecklistCorteService],
})
export class CorteModule {}
