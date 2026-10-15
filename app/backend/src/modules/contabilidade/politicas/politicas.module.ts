import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../../common/auditoria/auditoria.module';
import { PlanoContasModule } from '../plano/plano.module';
import { PoliticasContabilizacaoService } from './politicas.service';

@Module({
  imports: [PlanoContasModule, AuditoriaModule],
  providers: [PoliticasContabilizacaoService],
  exports: [PoliticasContabilizacaoService],
})
export class PoliticasContabilizacaoModule {}
