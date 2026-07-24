import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OperacoesModule } from '../../operacoes/operacoes.module';
import { PesagemModule } from '../pesagem/pesagem.module';
import { ExpedicaoController } from './expedicao.controller';
import { CaminhaoService } from './caminhao.service';
import { CargaService } from './carga.service';
import { ConferenciaService } from './conferencia.service';
import { FechamentoService } from './fechamento.service';
import { LiberacaoService } from './liberacao.service';

// F5 — Expedição. Reusa EtiquetaService (de PesagemModule) para conferência por QR (ADR-009).
// Gateways de hardware (leitor QR) vêm do HardwareModule (global).
@Module({
  imports: [AuthModule, PesagemModule, OperacoesModule],
  controllers: [ExpedicaoController],
  providers: [CaminhaoService, CargaService, ConferenciaService, FechamentoService, LiberacaoService],
  exports: [CaminhaoService, CargaService, ConferenciaService, FechamentoService, LiberacaoService],
})
export class ExpedicaoModule {}
