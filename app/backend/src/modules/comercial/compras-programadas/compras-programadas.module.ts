import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OperacoesModule } from '../../operacoes/operacoes.module';
import { RecebimentoModule } from '../../operacao/recebimento/recebimento.module';
import { DisponibilidadeModule } from '../disponibilidade/disponibilidade.module';
import { ComprasProgramadasController } from './compras-programadas.controller';
import { ComprasProgramadasService } from './compras-programadas.service';

@Module({
  imports: [AuthModule, DisponibilidadeModule, OperacoesModule, RecebimentoModule],
  controllers: [ComprasProgramadasController],
  providers: [ComprasProgramadasService],
})
export class ComprasProgramadasModule {}
