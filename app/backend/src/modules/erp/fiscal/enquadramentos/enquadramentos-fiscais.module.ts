import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { CfopsController } from './cfops.controller';
import { CfopsService } from './cfops.service';
import { EnquadramentosController } from './enquadramentos.controller';
import { EnquadramentosService } from './enquadramentos.service';
import { NcmsController } from './ncms.controller';
import { NcmsService } from './ncms.service';

@Module({
  imports: [AuthModule],
  controllers: [CfopsController, NcmsController, EnquadramentosController],
  providers: [CfopsService, NcmsService, EnquadramentosService],
  exports: [CfopsService, NcmsService, EnquadramentosService],
})
export class EnquadramentosFiscaisModule {}
