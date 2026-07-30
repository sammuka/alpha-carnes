import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DisponibilidadeController } from './disponibilidade.controller';
import { DisponibilidadeService } from './disponibilidade.service';
import { MapaService } from './mapa.service';

@Module({
  imports: [AuthModule],
  controllers: [DisponibilidadeController],
  providers: [DisponibilidadeService, MapaService],
  exports: [DisponibilidadeService, MapaService],
})
export class DisponibilidadeModule {}
