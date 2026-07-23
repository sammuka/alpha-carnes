import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DesossaController } from './desossa.controller';
import { FaltasService } from './faltas.service';
import { RegrasTransformacaoService } from './regras-transformacao.service';

@Module({
  imports: [AuthModule],
  controllers: [DesossaController],
  providers: [RegrasTransformacaoService, FaltasService],
  exports: [RegrasTransformacaoService, FaltasService],
})
export class DesossaModule {}
