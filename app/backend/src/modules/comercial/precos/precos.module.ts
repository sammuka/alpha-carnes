import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrecosController } from './precos.controller';
import { PrecosVigenteController } from './precos-vigente.controller';
import { PrecosService } from './precos.service';

@Module({
  imports: [AuthModule],
  controllers: [PrecosController, PrecosVigenteController],
  providers: [PrecosService],
  exports: [PrecosService],
})
export class PrecosModule {}
