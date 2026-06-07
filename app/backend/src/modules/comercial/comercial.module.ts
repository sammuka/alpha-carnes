import { Module } from '@nestjs/common';
import { ComprasProgramadasModule } from './compras-programadas/compras-programadas.module';
import { DisponibilidadeModule } from './disponibilidade/disponibilidade.module';
import { PedidosModule } from './pedidos/pedidos.module';

// Agregador do domínio comercial (F3).
@Module({
  imports: [ComprasProgramadasModule, DisponibilidadeModule, PedidosModule],
})
export class ComercialModule {}
