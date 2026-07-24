import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../../common/auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { OperacoesController } from './operacoes.controller';
import { OperacoesService } from './operacoes.service';

@Module({
  imports: [AuthModule, AuditoriaModule],
  controllers: [OperacoesController],
  providers: [OperacoesService],
  exports: [OperacoesService],
})
export class OperacoesModule {}
