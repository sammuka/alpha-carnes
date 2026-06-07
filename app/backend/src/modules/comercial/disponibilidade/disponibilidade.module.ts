import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { DisponibilidadeController } from './disponibilidade.controller';
import { DisponibilidadeService } from './disponibilidade.service';

@Module({
  imports: [AuthModule],
  controllers: [DisponibilidadeController],
  providers: [DisponibilidadeService],
  exports: [DisponibilidadeService],
})
export class DisponibilidadeModule {}
