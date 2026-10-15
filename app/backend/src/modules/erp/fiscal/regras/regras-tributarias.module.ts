import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { BeneficiosFiscaisController } from './beneficios-fiscais.controller';
import { BeneficiosFiscaisService } from './beneficios-fiscais.service';
import { ClassificacoesIbsCbsController } from './classificacoes-ibs-cbs.controller';
import { ClassificacoesIbsCbsService } from './classificacoes-ibs-cbs.service';

@Module({
  imports: [AuthModule],
  controllers: [BeneficiosFiscaisController, ClassificacoesIbsCbsController],
  providers: [BeneficiosFiscaisService, ClassificacoesIbsCbsService],
  exports: [BeneficiosFiscaisService, ClassificacoesIbsCbsService],
})
export class RegrasTributariasModule {}
