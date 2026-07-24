import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OperacoesModule } from '../../operacoes/operacoes.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [AuthModule, OperacoesModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
