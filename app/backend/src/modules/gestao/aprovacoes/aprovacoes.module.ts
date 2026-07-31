import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RecebimentoModule } from '../../operacao/recebimento/recebimento.module';
import { AprovacoesController } from './aprovacoes.controller';
import { AprovacoesService } from './aprovacoes.service';
import { ComparativoService } from './comparativo.service';

@Module({
  imports: [AuthModule, RecebimentoModule],
  controllers: [AprovacoesController],
  providers: [AprovacoesService, ComparativoService],
  exports: [AprovacoesService],
})
export class AprovacoesModule {}
