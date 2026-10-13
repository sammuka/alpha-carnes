import { Module } from '@nestjs/common';
import { AuthModule } from '../../../auth/auth.module';
import { EmpresasController } from './empresas.controller';
import { EmpresasService } from './empresas.service';
import { EstabelecimentosController } from './estabelecimentos.controller';
import { EstabelecimentosService } from './estabelecimentos.service';

@Module({
  imports: [AuthModule],
  controllers: [EmpresasController, EstabelecimentosController],
  providers: [EmpresasService, EstabelecimentosService],
  exports: [EmpresasService, EstabelecimentosService],
})
export class EmpresasFiscaisModule {}
