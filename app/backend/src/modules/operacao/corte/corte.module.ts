import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PesagemModule } from '../pesagem/pesagem.module';
import { RecebimentoModule } from '../recebimento/recebimento.module';
import { CorteController } from './corte.controller';
import { CorteService } from './corte.service';
import { SubitemService } from './subitem.service';

// F4c — Corte/Transformação. Reusa EtiquetaService (de PesagemModule) e
// DivergenciaRecebimentoService (de RecebimentoModule). Gateways de hardware
// vêm do HardwareModule (global).
@Module({
  imports: [AuthModule, PesagemModule, RecebimentoModule],
  controllers: [CorteController],
  providers: [CorteService, SubitemService],
  exports: [CorteService, SubitemService],
})
export class CorteModule {}
