import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditoriaModule } from '../../common/auditoria/auditoria.module';
import { ModelosEtiquetaController } from './modelos-etiqueta.controller';
import { ModelosEtiquetaService } from './modelos-etiqueta.service';

@Module({
  imports: [DatabaseModule, AuditoriaModule],
  controllers: [ModelosEtiquetaController],
  providers: [ModelosEtiquetaService],
  exports: [ModelosEtiquetaService],
})
export class ModelosEtiquetaModule {}
