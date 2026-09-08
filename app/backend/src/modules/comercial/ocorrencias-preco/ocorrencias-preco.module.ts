import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OcorrenciasPrecoController } from './ocorrencias-preco.controller';
import { OcorrenciasPrecoService } from './ocorrencias-preco.service';

@Module({
  imports: [AuthModule],
  controllers: [OcorrenciasPrecoController],
  providers: [OcorrenciasPrecoService],
  exports: [OcorrenciasPrecoService],
})
export class OcorrenciasPrecoModule {}
