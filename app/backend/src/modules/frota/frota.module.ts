import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditoriaModule } from '../../common/auditoria/auditoria.module';
import { CaminhoesCadastroController } from './caminhoes-cadastro.controller';
import { CaminhoesCadastroService } from './caminhoes-cadastro.service';
import { MotoristasController } from './motoristas.controller';
import { MotoristasService } from './motoristas.service';

@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [CaminhoesCadastroController, MotoristasController],
  providers: [CaminhoesCadastroService, MotoristasService],
  exports: [CaminhoesCadastroService, MotoristasService],
})
export class FrotaModule {}
