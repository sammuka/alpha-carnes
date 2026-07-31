import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DesossaController } from './desossa.controller';
import { FaltasService } from './faltas.service';
import { RegrasTransformacaoService } from './regras-transformacao.service';
import { PainelDesossaService } from './painel.service';
import { EtiquetasDesossaService } from './etiquetas-desossa.service';

@Module({
  imports: [AuthModule],
  controllers: [DesossaController],
  providers: [
    RegrasTransformacaoService,
    FaltasService,
    PainelDesossaService,
    EtiquetasDesossaService,
  ],
  exports: [
    RegrasTransformacaoService,
    FaltasService,
    PainelDesossaService,
    EtiquetasDesossaService,
  ],
})
export class DesossaModule {}
