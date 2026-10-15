import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../../common/auditoria/auditoria.module';
import { AuthModule } from '../../auth/auth.module';
import { PlanoContasService } from './plano.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  providers: [PlanoContasService],
  exports: [PlanoContasService],
})
export class PlanoContasModule {}
