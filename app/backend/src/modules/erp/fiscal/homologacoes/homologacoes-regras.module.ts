import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { RegrasTributariasModule } from '../regras/regras-tributarias.module';
import { HomologacoesController } from './homologacoes.controller';
import { HomologacoesService } from './homologacoes.service';

@Module({
  imports: [AuthModule, RegrasTributariasModule],
  controllers: [HomologacoesController],
  providers: [HomologacoesService],
})
export class HomologacoesRegrasModule {}
