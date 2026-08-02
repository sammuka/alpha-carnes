import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AprovacoesModule } from '../../gestao/aprovacoes/aprovacoes.module';
import { EstoqueController } from './estoque.controller';
import { EstoqueConsultaService } from './estoque-consulta.service';
import { DestinarEstoqueService } from './destinar.service';
import { EntradasEstoqueService } from './entradas.service';
import { AjustesEstoqueService } from './ajustes.service';
import { HistoricoEstoqueService } from './historico.service';

@Module({
  imports: [AuthModule, AprovacoesModule],
  controllers: [EstoqueController],
  providers: [
    EstoqueConsultaService,
    DestinarEstoqueService,
    EntradasEstoqueService,
    AjustesEstoqueService,
    HistoricoEstoqueService,
  ],
  exports: [EstoqueConsultaService],
})
export class EstoqueModule {}
