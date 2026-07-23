import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { EstoqueController } from './estoque.controller';
import { EstoqueConsultaService } from './estoque-consulta.service';

@Module({
  imports: [AuthModule],
  controllers: [EstoqueController],
  providers: [EstoqueConsultaService],
  exports: [EstoqueConsultaService],
})
export class EstoqueModule {}
