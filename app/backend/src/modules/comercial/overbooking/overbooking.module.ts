import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { OverbookingController } from './overbooking.controller';
import { OverbookingService } from './overbooking.service';

@Module({
  imports: [AuthModule, PedidosModule],
  controllers: [OverbookingController],
  providers: [OverbookingService],
  exports: [OverbookingService],
})
export class OverbookingModule {}
