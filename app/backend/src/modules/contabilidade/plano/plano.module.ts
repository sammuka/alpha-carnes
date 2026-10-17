import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../../common/auditoria/auditoria.module';
import { AuthModule } from '../../auth/auth.module';
import { PlanoContasController } from './plano.controller';
import { PlanoContasService } from './plano.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [PlanoContasController],
  providers: [PlanoContasService],
  exports: [PlanoContasService],
})
export class PlanoContasModule {}
