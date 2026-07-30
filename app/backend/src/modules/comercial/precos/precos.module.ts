import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrecosController } from './precos.controller';
import { PrecosService } from './precos.service';

@Module({
  imports: [AuthModule],
  controllers: [PrecosController],
  providers: [PrecosService],
  exports: [PrecosService],
})
export class PrecosModule {}
