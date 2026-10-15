import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../../common/auditoria/auditoria.module';
import { PlanoContasModule } from '../plano/plano.module';
import { PoliticasContabilizacaoController } from './politicas.controller';
import { PoliticasContabilizacaoService } from './politicas.service';

@Module({
  imports: [PlanoContasModule, AuditoriaModule],
  controllers: [PoliticasContabilizacaoController],
  providers: [PoliticasContabilizacaoService],
  exports: [PoliticasContabilizacaoService],
})
export class PoliticasContabilizacaoModule {}
