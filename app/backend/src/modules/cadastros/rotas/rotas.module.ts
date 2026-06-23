import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RotasController } from './rotas.controller';
import { RotasService } from './rotas.service';

@Module({
  imports: [AuthModule],
  controllers: [RotasController],
  providers: [RotasService],
})
export class RotasModule {}
