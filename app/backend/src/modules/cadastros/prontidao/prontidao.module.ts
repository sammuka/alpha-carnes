import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { ProntidaoController } from './prontidao.controller';
import { ProntidaoService } from './prontidao.service';

@Module({
  imports: [AuthModule],
  controllers: [ProntidaoController],
  providers: [ProntidaoService],
  exports: [ProntidaoService],
})
export class ProntidaoModule {}
