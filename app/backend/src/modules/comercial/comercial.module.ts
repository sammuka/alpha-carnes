import { Module } from '@nestjs/common';
import { ComprasProgramadasModule } from './compras-programadas/compras-programadas.module';
import { DisponibilidadeModule } from './disponibilidade/disponibilidade.module';

// Agregador do domínio comercial (F3). Os submódulos (pedidos) entram aqui.
@Module({
  imports: [ComprasProgramadasModule, DisponibilidadeModule],
})
export class ComercialModule {}
