import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParametrosController } from './parametros.controller';
import { ParametrosService } from './parametros.service';

@Module({
  imports: [AuthModule],
  controllers: [ParametrosController],
  providers: [ParametrosService],
})
export class ParametrosModule {}
