import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaConsultaService } from './auditoria.service';

@Module({
  imports: [AuthModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaConsultaService],
})
export class AuditoriaConsultaModule {}
