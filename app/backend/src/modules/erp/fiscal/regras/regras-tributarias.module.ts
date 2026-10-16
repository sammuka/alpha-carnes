import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { BeneficiosFiscaisController } from './beneficios-fiscais.controller';
import { BeneficiosFiscaisService } from './beneficios-fiscais.service';
import { ClassificacoesIbsCbsController } from './classificacoes-ibs-cbs.controller';
import { ClassificacoesIbsCbsService } from './classificacoes-ibs-cbs.service';
import { RegrasController } from './regras.controller';
import { RegrasTributariasService } from './regras.service';

@Module({
  imports: [AuthModule],
  controllers: [BeneficiosFiscaisController, ClassificacoesIbsCbsController, RegrasController],
  providers: [BeneficiosFiscaisService, ClassificacoesIbsCbsService, RegrasTributariasService],
  exports: [BeneficiosFiscaisService, ClassificacoesIbsCbsService, RegrasTributariasService],
})
export class RegrasTributariasModule {}
