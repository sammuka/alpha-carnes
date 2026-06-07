import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ItensCompraController } from './itens-compra.controller';
import { ItensCompraService } from './itens-compra.service';

@Module({
  imports: [AuthModule],
  controllers: [ItensCompraController],
  providers: [ItensCompraService],
})
export class ItensCompraModule {}
