import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SifCalculoService } from './sif-calculo.service';
import { SifController } from './sif.controller';
import { SifService } from './sif.service';

@Module({
  imports: [AuthModule],
  controllers: [SifController],
  providers: [SifService, SifCalculoService],
  exports: [SifService],
})
export class SifModule {}
