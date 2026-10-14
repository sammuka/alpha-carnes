import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { CfopsController } from './cfops.controller';
import { CfopsService } from './cfops.service';
import { NcmsController } from './ncms.controller';
import { NcmsService } from './ncms.service';

@Module({
  imports: [AuthModule],
  controllers: [CfopsController, NcmsController],
  providers: [CfopsService, NcmsService],
  exports: [CfopsService, NcmsService],
})
export class EnquadramentosFiscaisModule {}
